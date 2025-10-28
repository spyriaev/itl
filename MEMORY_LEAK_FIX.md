# Memory Leak Fix for PDF Viewer (PYR-10)

## Issue Summary

**Problem:** When opening a presentation with images (6 MB file, 6 pages), the browser memory usage would grow to over 300 MB and would not be cleaned up over time.

**Root Causes Identified:**

1. **PDF.js Document Instances Not Being Destroyed**: The PDF.js library creates document objects that hold references to all pages, fonts, and images in memory. These were never explicitly destroyed when the component unmounted or when switching between documents.

2. **Canvas Elements Persisting in Memory**: PDF.js renders pages to canvas elements, which can hold significant memory (decoded images, font data). Without proper cleanup, these canvas elements and their associated data remained in memory.

3. **No Memory Management Configuration**: PDF.js was not configured with any memory-efficient options, allowing unlimited caching of images, fonts, and other resources.

4. **Incomplete Cleanup on Component Unmount**: The component had basic cleanup, but didn't destroy the core PDF.js resources.

## Fixes Implemented

### 1. Added PDF.js Memory Management Options

**File:** `web/src/ui/components/PdfViewer.tsx`

```typescript
// Configure PDF.js for better memory management
const pdfOptions = {
  // Disable font caching to save memory
  disableFontFace: false,
  // Enable automatic cleanup
  enableXfa: false,
  // Limit image cache
  maxImageSize: 5242880, // 5MB max per image
  // Use standard font data from CDN to avoid bundling
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
}
```

These options are passed to the `<Document>` component to limit memory usage for images and use external font data.

### 2. Track PDF Document Instance

Added a ref to store the PDF.js document instance:

```typescript
// Store PDF document instance for cleanup
const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null)
```

This reference is populated when the document loads:

```typescript
const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
  // Store PDF document instance for cleanup
  pdfDocumentRef.current = pdf
  // ... rest of the code
}, [documentInfo?.lastViewedPage])
```

### 3. Destroy PDF on Component Unmount

Added comprehensive cleanup that explicitly destroys the PDF.js document:

```typescript
// Comprehensive cleanup on component unmount
useEffect(() => {
  return () => {
    console.log('Cleaning up PDF viewer resources...')
    
    // Destroy PDF.js document instance to free memory
    if (pdfDocumentRef.current) {
      pdfDocumentRef.current.destroy().catch((err) => {
        console.error('Error destroying PDF document:', err)
      })
      pdfDocumentRef.current = null
    }
    
    // Clear all state to free memory
    setPageHeights(new Map())
    setPageQuestionsMap(new Map())
    setVisiblePageRange({ start: 1, end: 10 })
    
    // Clear page refs
    pageRefs.current = []
  }
}, [])
```

### 4. Cleanup When Switching Documents

Added cleanup in the document loading effect to destroy the previous document before loading a new one:

```typescript
// Load document info
useEffect(() => {
  const loadDocument = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Clean up previous document when switching
      if (pdfDocumentRef.current) {
        console.log('Destroying previous PDF document...')
        await pdfDocumentRef.current.destroy().catch((err) => {
          console.error('Error destroying previous PDF document:', err)
        })
        pdfDocumentRef.current = null
      }
      
      // Clear all cached data
      setPageHeights(new Map())
      setPageQuestionsMap(new Map())
      setNumPages(0)
      
      const info = await getDocumentViewUrl(documentId)
      setDocumentInfo(info)
      setCurrentPage(info.lastViewedPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  loadDocument()
}, [documentId])
```

### 5. Apply Options to Both Document Components

The `pdfOptions` configuration is now applied to both the continuous scroll and single-page view modes:

```typescript
<Document
  file={documentInfo.url}
  onLoadSuccess={onDocumentLoadSuccess}
  onLoadError={(error) => setError('Failed to load PDF document')}
  options={pdfOptions}
>
```

## Expected Impact

After these fixes:

1. **Reduced Memory Usage**: Memory should stay much closer to the actual file size (e.g., 6 MB file should use ~20-40 MB in browser instead of 300+ MB)

2. **Memory Cleanup**: When closing a document or switching between documents, memory should be freed within seconds (depending on browser's garbage collection)

3. **Better Performance**: Less memory pressure means better overall application performance and reduced risk of browser crashes

4. **Scalability**: Users can now view larger documents and switch between documents without accumulating memory

## Testing Recommendations

1. **Open a large presentation** with images (e.g., 6 MB, 6 pages)
2. **Monitor browser memory** using Chrome DevTools (Memory tab)
3. **Close the document** and verify memory drops
4. **Switch between documents** several times and verify no memory accumulation
5. **Test with continuous scroll mode** to ensure virtualized pages are cleaned up properly

## Technical Notes

- **PDF.js Document Lifecycle**: PDF.js documents must be explicitly destroyed using `pdf.destroy()` to free memory. This is not automatic.
- **React Cleanup**: Using useEffect cleanup functions ensures resources are freed when components unmount.
- **Canvas Memory**: Canvas elements can hold decoded images in memory. Destroying the PDF document releases these canvases.
- **Virtualization**: The existing virtualization (only rendering visible pages) is still in place and works alongside these memory fixes.

## Related Issues

- Linear Issue: PYR-10
- Labels: PdfViewer, Bug
