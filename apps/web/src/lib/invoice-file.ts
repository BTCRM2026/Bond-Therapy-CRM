export async function prepareImageFile(file: File, maxDimension = 2000, quality = 0.82, minSize = 2 * 1024 * 1024) {
  if (!file.type.startsWith("image/") || file.size < minSize) return file;
  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) { image.close(); return file; }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const prepareInvoiceFile = (file: File) => prepareImageFile(file);
