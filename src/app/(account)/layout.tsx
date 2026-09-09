import { AccountChrome } from "./account-chrome";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountChrome>{children}</AccountChrome>;
}
