// The website owns its avatars. Google profile pictures are never used.
// Profile image data is a small, private image saved in Firestore.
// Everyone without an uploaded photo gets the same original mascot illustration.
function showDefaultAvatar(element) {
  element.replaceChildren();
  const image = document.createElement("img");
  image.src = "./default-avatar.svg?v=mascot-1";
  image.alt = "";
  image.decoding = "async";
  element.appendChild(image);
}

export function renderAvatar(element, profile = null) {
  if (!element) return;
  element.replaceChildren();
  const imageData = profile?.avatarData;
  if (typeof imageData === "string" &&
      /^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(imageData) &&
      imageData.length <= 50000) {
    const img = document.createElement("img");
    img.src = imageData;
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("error", () => {
      showDefaultAvatar(element);
    }, { once: true });
    element.appendChild(img);
  } else {
    showDefaultAvatar(element);
  }
}

// Keep uploaded photos tiny so they fit safely in an ordinary Firestore
// document without requiring Cloud Storage / paid storage setup.
export async function prepareAvatar(file) {
  const permitted = ["image/jpeg", "image/png", "image/webp"];
  if (!permitted.includes(file?.type)) {
    throw new Error("Choose a JPG, PNG, or WebP picture.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Please choose an image smaller than 5 MB.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) throw new Error("Invalid image.");
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - sourceSize) / 2);
    const sy = Math.floor((bitmap.height - sourceSize) / 2);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot resize pictures.");

    for (const size of [160, 128, 96, 72, 56]) {
      canvas.width = canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bitmap, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
      for (const quality of [0.8, 0.6, 0.45]) {
        const data = canvas.toDataURL("image/webp", quality);
        // WebP may fall back to PNG on unsupported browsers.
        if (/^data:image\/(webp|png);base64,/.test(data) && data.length <= 48000) {
          return data;
        }
      }
    }
    throw new Error("This picture couldn't be compressed enough. Try another image.");
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Couldn't read that picture. Try a JPG or PNG.");
  } finally {
    bitmap?.close();
  }
}
