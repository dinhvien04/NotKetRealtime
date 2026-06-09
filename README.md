# Nối Kết Realtime

Ứng dụng chat riêng 1-1 theo thời gian thực, xây dựng bằng Node.js, Express, Socket.IO và JavaScript thuần. Danh sách người dùng và tin nhắn được lưu tạm trong bộ nhớ server, không sử dụng cơ sở dữ liệu.

## Công nghệ sử dụng

- Node.js
- Express
- Socket.IO
- HTML5, CSS3 và JavaScript thuần
- Kiến trúc MVC

## Kiến trúc MVC

- `server.js`: tạo HTTP server, khởi tạo Socket.IO và lắng nghe cổng.
- `src/app.js`: cấu hình Express, static middleware và route.
- `src/routes/`: khai báo route web.
- `src/controllers/`: xử lý trang và toàn bộ sự kiện Socket.IO.
- `src/models/`: quản lý người dùng online và tin nhắn trong bộ nhớ.
- `src/utils/`: làm sạch dữ liệu nhập và định dạng thời gian.
- `views/`: giao diện HTML chính.
- `public/`: CSS và JavaScript chạy trên trình duyệt.

## Cấu trúc thư mục

```text
noi-ket-realtime/
├── package.json
├── server.js
├── README.md
├── src/
│   ├── app.js
│   ├── routes/
│   │   └── web.routes.js
│   ├── controllers/
│   │   ├── page.controller.js
│   │   └── socket.controller.js
│   ├── models/
│   │   ├── user.model.js
│   │   └── message.model.js
│   └── utils/
│       ├── sanitize.js
│       └── time.js
├── views/
│   ├── index.html
│   └── chat.html
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── client.js
└── stitch_giao_di_n_chat_realtime/
    └── ...các mẫu giao diện gốc
```

## Cài đặt và chạy

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm start
```

Mở trình duyệt tại:

```text
http://localhost:3000
```

Có thể kiểm tra cú pháp các tệp JavaScript bằng:

```bash
npm run check
```

## Chức năng chính

- Dự án chỉ có 2 giao diện HTML để dễ bảo trì:
  - `views/index.html`: trang chủ và form nhập tên.
  - `views/chat.html`: danh sách online, chat riêng, tin nhắn realtime và trạng thái offline.
- Nhập tên và tham gia phòng chat không tải lại trang.
- Tự thêm số phía sau nếu tên người dùng bị trùng.
- Cập nhật danh sách online theo thời gian thực.
- Chat riêng đúng người nhận.
- Hiển thị tin gửi, tin nhận và thời gian gửi.
- Hiển thị trạng thái đang nhập.
- Thông báo tin nhắn chưa đọc.
- Vô hiệu hóa ô nhập khi người đang chat rời đi.
- Hiển thị lớp trạng thái mất kết nối và tự tham gia lại khi server phục hồi.
- Làm sạch tên và nội dung tin nhắn ở server; phía client render bằng `textContent`.
- Responsive cho máy tính bảng và điện thoại.

Tin nhắn chỉ tồn tại trong bộ nhớ. Khi server dừng hoặc khởi động lại, lịch sử sẽ bị xóa.

## Mapping giao diện Stitch

Các file `screen.png` chỉ được dùng để tham khảo. Ứng dụng thật được dựng từ HTML, CSS và JavaScript:

| Mẫu Stitch | Phần được tích hợp | File đích |
|---|---|---|
| `trang_ch_ng_d_ng_chat_realtime` | Bố cục landing hai cột, danh sách ba tính năng, thẻ nhập tên | `views/index.html`, `public/css/style.css` |
| `m_n_h_nh_b_t_u_chat_realtime` | Form nhập tên, nền gradient, ghi chú tên hiển thị | `views/index.html`, `public/css/style.css` |
| `m_n_h_nh_ch_nh_chat_realtime` | Header ứng dụng, sidebar 320px, danh sách online, empty state | `views/chat.html`, `public/css/style.css`, `public/js/client.js` |
| `m_n_h_nh_chat_ri_ng_chat_realtime` | Header người nhận, vùng hội thoại, ô nhập và nút gửi | `views/chat.html`, `public/css/style.css` |
| `m_ph_ng_tin_nh_n_realtime_chat_realtime` | Bubble gửi/nhận, thời gian, trạng thái đang nhập | `public/css/style.css`, `public/js/client.js` |
| `tr_ng_th_i_m_t_k_t_n_i_chat_realtime` | Trạng thái người nhận offline và lớp mất kết nối server | `views/chat.html`, `public/css/style.css`, `public/js/client.js` |
| `skyline_flow/DESIGN.md` | Màu sắc, typography, bo góc, khoảng cách và độ nổi | `public/css/style.css` |

Tailwind và dữ liệu mẫu của Stitch không được đưa vào bản chạy thật. CSS đã được tinh gọn thành CSS thuần; người dùng, tin nhắn và trạng thái đều lấy từ Socket.IO.

## Đặt thư mục Stitch

Giữ hoặc sao chép toàn bộ thư mục export vào ngay thư mục gốc dự án:

```text
noi-ket-realtime/stitch_giao_di_n_chat_realtime/
```

Không cần chuyển `screen.png` vào `public` và không cần mở trực tiếp các `code.html`. Chúng là tài liệu thiết kế nguồn; ứng dụng sử dụng các file đã tích hợp trong `views/` và `public/`.

## Kiểm tra realtime bằng hai tab

1. Chạy `npm start`.
2. Mở `http://localhost:3000` ở hai tab.
3. Tab thứ nhất nhập tên, ví dụ `Minh Anh`.
4. Tab thứ hai nhập tên, ví dụ `Quốc Bảo`.
5. Chọn người còn lại trong sidebar và gửi tin nhắn.
6. Kiểm tra tin nhắn, trạng thái đang nhập và danh sách online cập nhật ngay.
7. Đóng một tab để kiểm tra thông báo offline và ô nhập bị vô hiệu hóa.
