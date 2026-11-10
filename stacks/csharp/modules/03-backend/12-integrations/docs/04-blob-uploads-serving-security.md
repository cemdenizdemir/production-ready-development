---
title: Uploads and file serving with Blob Storage
tech: Azure Blob Storage, user delegation SAS, Defender for Storage, Azure Front Door
version: Azure.Storage.Blobs 12.x, Azure.Identity 1.x
date: 2026-11-09
covers: [6, 7, 8]
---
# Uploads and file serving with Blob Storage
[← Overview](00-overview.md)

## Why it matters
- Product images were uploaded through the API. A few 50 MB files tied up threads and memory, and the API slowed for everyone. Direct-to-storage uploads remove that load.
- The container was set to public access "for simplicity". Invoices of every customer could be downloaded by guessing `invoice-1043.pdf`.
- A file named `avatar.png` was actually an HTML page with a script. It was served from the shop's domain with `Content-Type: text/html`: stored XSS.

## Concepts

### Direct uploads with SAS
```mermaid
sequenceDiagram
  participant B as Browser
  participant API as Shop API
  participant BS as Blob Storage (quarantine)
  participant D as Defender for Storage
  B->>API: POST /uploads {fileName, size, contentType}
  API->>API: authorise, validate size/type, create Upload record, blob name = GUID
  API-->>B: upload URL with write-only SAS (5 min)
  B->>BS: PUT blob (x-ms-blob-type: BlockBlob)
  BS->>D: on-upload malware scan
  D-->>API: scan result (Event Grid)
  API->>BS: verify size + magic bytes; copy to "products" container; delete from quarantine
```
| Rule | How |
|:--|:--|
| ⭐ private containers | public access disabled on the storage account |
| ⭐ user delegation SAS | signed with Entra ID (`GetUserDelegationKeyAsync`); no account keys in the app |
| ⭐ narrow SAS | one blob, `Create`/`Write` only, 5–15 minutes, HTTPS only |
| ⭐ server-chosen names | `uploads/{guid}`; never the user's file name as the path |
| size limits | SAS can't limit size: check `ContentLength` after upload and reject; set a client-side limit for UX |
| type limits | allow-list by extension **and** magic bytes after upload; never trust the `Content-Type` header |
| CORS | allow `PUT` from your frontend origin on the storage account |

### Serving files
| Option | Use |
|:--|:--|
| ⭐ short-lived read SAS | private files (invoices, exports): 5–15 min, one blob, `Read` only, generated after an authorisation check |
| SAS response overrides | `ContentDisposition = "attachment; filename=invoice-1043.pdf"`, `ContentType` |
| Front Door + Private Link origin | public assets (product images) cached at the edge; storage not public |
| API streaming | when you must check access on every byte or transform files |
| immutable names | `products/{guid}/{width}.webp` → `Cache-Control: public, max-age=31536000, immutable` |

### Upload security
| Threat | Defence |
|:--|:--|
| ⭐ malware | Defender for Storage on-upload malware scanning; quarantine until "no threats found" |
| ⭐ wrong type / polyglot files | magic bytes check; re-encode images (resize to WebP) so only pixels survive |
| stored XSS | never serve user files as `text/html` or SVG from your main domain; `Content-Disposition: attachment`; separate domain for user content |
| path traversal / overwrite | GUID names; SAS for a single new blob |
| zip bombs, huge images | size and pixel-count limits before processing |
| privacy | strip EXIF (location) from photos |
| abuse | rate-limit upload requests per user; quotas per account |

## Example
`src/Modules/Catalog/Shop.Catalog/Uploads/UploadUrls.cs`
```csharp
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

internal sealed class UploadUrls(BlobServiceClient blobs, TimeProvider time)
{
    private static readonly HashSet<string> Allowed = [".jpg", ".jpeg", ".png", ".webp"];
    public const long MaxBytes = 10 * 1024 * 1024;

    public async Task<Result<UploadTicket>> CreateAsync(string fileName, long size, CancellationToken ct)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!Allowed.Contains(ext) || size is <= 0 or > MaxBytes)
            return new Error("upload.invalid", "Only JPG, PNG, or WebP up to 10 MB.", ErrorType.Validation);

        var now = time.GetUtcNow();
        var key = await blobs.GetUserDelegationKeyAsync(now.AddMinutes(-5), now.AddMinutes(15), ct);   // cache it in production
        var blob = blobs.GetBlobContainerClient("quarantine").GetBlobClient($"{Guid.NewGuid():N}{ext}");

        var sas = new BlobSasBuilder
        {
            BlobContainerName = blob.BlobContainerName, BlobName = blob.Name, Resource = "b",
            StartsOn = now.AddMinutes(-1), ExpiresOn = now.AddMinutes(5), Protocol = SasProtocol.Https,
        };
        sas.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);

        var uri = new BlobUriBuilder(blob.Uri) { Sas = sas.ToSasQueryParameters(key.Value, blobs.AccountName) }.ToUri();
        return new UploadTicket(blob.Name, uri, now.AddMinutes(5));
    }
}
```
After the scan result arrives (Event Grid → handler):
```csharp
var props = await quarantineBlob.GetPropertiesAsync(cancellationToken: ct);
if (props.Value.ContentLength > UploadUrls.MaxBytes) { await quarantineBlob.DeleteAsync(cancellationToken: ct); return; }

await using var stream = await quarantineBlob.OpenReadAsync(cancellationToken: ct);
var header = new byte[12];
await stream.ReadExactlyAsync(header, ct);
if (!FileSignatures.IsImage(header)) { await quarantineBlob.DeleteAsync(cancellationToken: ct); return; }   // JPEG FF D8 FF, PNG 89 50 4E 47, WebP RIFF....WEBP
// re-encode to WebP sizes into the "products" container, then delete the quarantine blob
```
Short-lived download link for an invoice:
```csharp
var sas = new BlobSasBuilder(BlobSasPermissions.Read, now.AddMinutes(10))
{
    BlobContainerName = "invoices", BlobName = invoice.BlobName, Resource = "b",
    ContentDisposition = $"attachment; filename=invoice-{invoice.Number}.pdf", ContentType = "application/pdf",
};
```
Generate it only after checking that the invoice belongs to the signed-in user.

## Production patterns
- Storage accounts with public access and shared keys disabled; the app uses managed identity and user delegation SAS (cache the delegation key, it's valid up to 7 days).
- Uploads go straight to a quarantine container with a narrow SAS; files are promoted only after malware scan, size, and magic-byte checks; images are re-encoded.
- Private files are served with short-lived read SAS after authorisation; public assets through Front Door with long cache lifetimes and immutable names.
- Upload and download events logged (who, what, when) for support and audits; lifecycle rules delete abandoned quarantine blobs.

## Mistakes
Wrong:
```csharp
var sas = container.GenerateSasUri(BlobContainerSasPermissions.All, DateTimeOffset.UtcNow.AddYears(1));   // whole container, a year, account key
```
Right: one blob, minimal permissions, minutes of validity, user delegation key.

Wrong: `BlobName = $"{userFileName}"` and trusting `Content-Type: image/png` from the browser.
Right: server-generated names; verify content after upload.

## Check yourself
1. Why upload directly to Blob Storage instead of through the API?
2. What can't a SAS enforce, and how do you handle it?
3. Why re-encode uploaded images?

<details><summary>Answers</summary>

1. The API doesn't spend threads, memory, and bandwidth proxying large files; uploads scale with the storage service; and the API only issues a short-lived, narrow permission.
2. File size and real content type. Check the blob's size and magic bytes after upload (in quarantine), scan it, and only then move it to its final container.
3. Re-encoding keeps only the image pixels, which removes hidden payloads (polyglot files, scripts, metadata such as GPS location) and normalises size and format.
</details>

## Sources
- [Create a user delegation SAS (.NET)](https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-dotnet)
- [SAS best practices](https://learn.microsoft.com/azure/storage/common/storage-sas-overview#best-practices-when-using-sas)
- [Defender for Storage malware scanning](https://learn.microsoft.com/azure/defender-for-cloud/introduction-malware-scanning)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Front Door with Private Link to storage](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-storage-account)
- [Prevent anonymous read access to blobs](https://learn.microsoft.com/azure/storage/blobs/anonymous-read-access-prevent)
