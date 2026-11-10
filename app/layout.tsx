import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MEDIA HUB | Khoa Truyền thông & Thiết kế HUTECH",
  description: "Cổng thông tin sự kiện, tin tức và hoạt động sinh viên Khoa Truyền thông & Thiết kế HUTECH."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="vi"><body>{children}</body></html>;
}