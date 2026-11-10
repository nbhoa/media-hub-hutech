# MEDIA HUB HUTECH — website có CMS quản trị

Bản này là bộ mã nguồn Next.js + Supabase, gồm website công khai, đăng nhập quản trị, quản lý sự kiện/bài viết, upload ảnh bìa và album. Có thể chạy local ngay sau khi cấu hình Supabase.

## Có gì trong bộ này?
- Trang chủ responsive được tinh chỉnh theo giao diện `index.html` bạn cung cấp: hero, bộ lọc sự kiện, thẻ sự kiện, giới thiệu MEDIA HUB và khu vực kêu gọi đăng sự kiện.
- Nội dung mẫu trong file HTML gốc không tự động nhập vào cơ sở dữ liệu; hãy kiểm tra và tạo lại các sự kiện chính thức trong CMS.
- Sự kiện và tin tức đọc từ cơ sở dữ liệu; chỉ nội dung `published` xuất hiện công khai.
- `/admin`: đăng nhập, dashboard, tạo/sửa/xóa sự kiện và bài viết, lưu nháp hoặc xuất bản.
- Upload ảnh lên Supabase Storage, ảnh bìa và nhiều ảnh album.
- Phân vai `admin`, `editor`, `organizer`, `student`; quyền ghi dữ liệu được bảo vệ bằng Row Level Security (RLS).
- Chưa mở chức năng tự đăng ký tài khoản công khai; quản trị viên tạo tài khoản trong Supabase Auth để kiểm soát người được vào CMS.

## Yêu cầu
- Node.js 18.17+ (khuyến nghị Node 20)
- Tài khoản Supabase
- Tài khoản Vercel để triển khai link public

## A. Tạo cơ sở dữ liệu Supabase
1. Tạo project tại https://supabase.com/dashboard.
2. Mở **SQL Editor → New query**.
3. Mở file `supabase/schema.sql`, copy toàn bộ và chạy.
4. Vào **Project Settings → API** lấy `Project URL` và `anon/public key`. Không dùng `service_role` key ở frontend.
5. Vào **Authentication → Providers → Email** bật Email provider. Nếu cần demo nhanh, có thể tắt Confirm email trong Authentication settings; khi dùng thật nên giữ xác minh email.
6. Trong **Authentication → Users**, tạo người dùng quản trị đầu tiên bằng email và mật khẩu mạnh.
7. Quay lại SQL Editor, chạy lệnh dưới đây, thay email thành email quản trị vừa tạo:
   ```sql
   update public.profiles p
   set role='admin'
   from auth.users u
   where p.id=u.id and u.email='admin@your-domain.vn';
   ```
8. Tạo thêm tài khoản trong Authentication → Users cho biên tập viên/ban tổ chức, rồi gán vai trò:
   ```sql
   update public.profiles p
   set role='editor'
   from auth.users u
   where p.id=u.id and u.email='editor@your-domain.vn';
   ```
   Có thể thay `editor` bằng `organizer`. Tài khoản mới mặc định `student` và không có quyền đăng nội dung.

## B. Chạy website trên máy
1. Giải nén ZIP, mở thư mục bằng VS Code.
2. Tạo file `.env.local` ở thư mục gốc, dựa trên `.env.example`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
3. Mở Terminal:
   ```bash
   npm install
   npm run dev
   ```
4. Truy cập http://localhost:3000. Trang quản trị: http://localhost:3000/admin.

## C. Đưa website lên link Vercel miễn phí
1. Tạo repository GitHub và đẩy toàn bộ source code lên (không đưa `.env.local` lên GitHub).
2. Đăng nhập https://vercel.com, chọn **Add New → Project**, import repository.
3. Trong **Environment Variables**, thêm:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Bấm **Deploy**. Vercel sẽ cấp link dạng `media-hub-hutech.vercel.app` (tên khả dụng tùy tình trạng).
5. Mở Supabase → Authentication → URL Configuration:
   - Site URL: link Vercel thực tế.
   - Redirect URLs: thêm `https://<link-vercel-cua-ban>/**` và `http://localhost:3000/**`.
6. Mỗi lần cập nhật source và push GitHub, Vercel tự triển khai lại.

## D. Luồng sử dụng
- Sinh viên vào link website để xem sự kiện/bài viết đã xuất bản.
- Ban quản trị truy cập `/admin`, đăng nhập bằng tài khoản được cấp.
- Chọn Sự kiện hoặc Bài viết, điền nội dung, tải ảnh bìa/album.
- Chọn “Lưu bản nháp” hoặc “Xuất bản công khai”.
- Nội dung đã xuất bản sẽ xuất hiện trên trang chủ.

## Lưu ý quan trọng trước khi vận hành chính thức
- Đây là mã nguồn triển khai được, nhưng chưa thể tự xuất bản ra Internet nếu chưa có project Supabase/Vercel do chủ sở hữu tạo và cấp quyền.
- Link Vercel được tạo tự động khi bạn triển khai trong tài khoản Vercel; không thể tự đoán trước link khả dụng.
- Hãy dùng email trường hoặc email công vụ để cấp tài khoản; không chia sẻ mật khẩu quản trị.
- Ảnh upload giới hạn 10 MB mỗi file, định dạng JPG/PNG/WebP/GIF.
- Bản hiện tại là CMS cơ bản. Phân quyền đang ở mức: admin/editor/organizer đều có thể quản lý nội dung. Nếu muốn organizer chỉ quản lý sự kiện do nhóm mình tạo, cần bổ sung chính sách ownership theo nhóm.
- Đã có trang đọc chi tiết `/event/[slug]` và `/post/[slug]`; trang chủ liên kết tới trang chi tiết và hiển thị album ảnh.
- Cần kiểm tra lại nội dung, hình ảnh, thông tin nhận diện và được Khoa/Trường chấp thuận trước khi dùng logo hoặc nhận diện chính thức HUTECH.


### Lưu ý API key
Dùng Supabase Publishable key (`sb_publishable_...`) trong biến `NEXT_PUBLIC_SUPABASE_ANON_KEY` của dự án này. Không đưa `service_role` hoặc secret key vào frontend.
