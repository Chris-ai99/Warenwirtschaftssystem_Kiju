/* eslint-disable @next/next/no-img-element */
import { displayableImageUrl } from "@/lib/image-url";

type Props = {
  src?: string | null;
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
};

export function ArticleImage({ src, alt, className, loading = "lazy" }: Props) {
  const imageUrl = displayableImageUrl(src);
  if (!imageUrl) return null;

  return (
    <div className={className}>
      <img
        src={imageUrl}
        alt={alt}
        loading={loading}
        onError={(event) => {
          event.currentTarget.parentElement?.setAttribute("hidden", "true");
        }}
      />
    </div>
  );
}
