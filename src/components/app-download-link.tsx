import type { ReactNode } from "react";
import {
  WINDOWS_APP_DOWNLOAD_FILENAME,
  WINDOWS_APP_DOWNLOAD_URL,
} from "@/lib/constants";

/** Forces a local MSI download (do not use Next.js Link for installer files). */
export function AppDownloadLink({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={WINDOWS_APP_DOWNLOAD_URL}
      download={WINDOWS_APP_DOWNLOAD_FILENAME}
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
