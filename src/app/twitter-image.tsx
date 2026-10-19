import OpenGraphImage from "./opengraph-image";

// Same sample frame as the Open Graph card; metadata fields are declared here so Next can read them statically.
export const alt =
  "Sample Autoplayed frame: The Binge Lord, 5,626 titles. Then compare with your friends. Autoplayed is not affiliated with Netflix.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return OpenGraphImage();
}
