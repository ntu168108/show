# 🎬 Hướng dẫn tải phim từ Rổ Phim

Hướng dẫn chi tiết để tải phim và phụ đề từ Rổ Phim sử dụng Tampermonkey và yt-dlp.

## 📋 Yêu cầu hệ thống

- **Trình duyệt**: Chrome, Firefox, Edge (có hỗ trợ Tampermonkey)
- **Hệ điều hành**: Ubuntu/Linux (để tải xuống)
- **Kết nối mạng**: Ổn định để tải file lớn

## 🚀 Bước 1: Cài đặt Extension

1. **Cài đặt Tampermonkey**:
   - Truy cập [Tampermonkey Store](https://www.tampermonkey.net/)
   - Cài đặt extension cho trình duyệt của bạn

2. **Thêm script**:
   - Mở Tampermonkey Dashboard
   - Import file: `Grab m3u8 + vtt (allowlist, filename, filter cvt.-, robust copy)-3.5.user.js`

3. **Sử dụng**:
   - Truy cập Rổ Phim
   - Chọn phim muốn tải
   - Extension sẽ tự động hiển thị link tải phim và phụ đề
   - **Lưu ý**: Nếu chỉ hiện 1 file sub, nghĩa là phụ đề đã được nhúng sẵn trong phim

## 💻 Bước 2: Cài đặt công cụ tải xuống (Ubuntu)

### Cập nhật hệ thống và cài đặt dependencies

```bash
sudo apt update && sudo apt install -y yt-dlp aria2 ffmpeg
sudo apt install -y pipx
pipx ensurepath
pipx install --force yt-dlp
```

### Khởi động lại terminal hoặc chạy:
```bash
source ~/.bashrc
```

## 📥 Bước 3: Tải phim

Sử dụng lệnh sau để tải phim với tốc độ và độ ổn định tối ưu:

```bash
yt-dlp \
  --downloader aria2c \
  --downloader-args "aria2c:-c -x 16 -s 16 -k 32M --summary-interval=1" \
  --concurrent-fragments 64 \
  --retries infinite \
  --fragment-retries infinite \
  --no-abort-on-unavailable-fragment \
  "<link_phim_từ_extension>" \
  -o "<tên_phim>.%(ext)s"
```

### Ví dụ thực tế:
```bash
yt-dlp \
  --downloader aria2c \
  --downloader-args "aria2c:-c -x 16 -s 16 -k 32M --summary-interval=1" \
  --concurrent-fragments 64 \
  --retries infinite \
  --fragment-retries infinite \
  --no-abort-on-unavailable-fragment \
  "https://example.com/movie.m3u8" \
  -o "Tên_Phim_Hay.%(ext)s"
```

## 🎯 Tính năng chính

- ✅ **Tải song song**: Sử dụng 16 kết nối đồng thời
- ✅ **Khôi phục tải**: Tự động tiếp tục khi bị gián đoạn  
- ✅ **Tối ưu tốc độ**: Chunk size 32MB cho hiệu suất tốt nhất
- ✅ **Xử lý lỗi**: Thử lại vô hạn khi gặp lỗi
- ✅ **Tự động format**: Giữ nguyên định dạng gốc

## 📁 Cấu trúc thư mục

```
show/
├── README.md                          # Hướng dẫn này
├── rophim-download-extension/         # Script và công cụ
│   ├── Grab m3u8 + vtt (...).user.js # Tampermonkey script
│   └── hdsd.txt                       # Hướng dẫn bổ sung
```

## ⚠️ Lưu ý quan trọng

- **Băng thông**: Tải phim có thể tốn nhiều dung lượng internet
- **Bản quyền**: Chỉ tải phim từ nguồn hợp pháp
- **Lưu trữ**: Đảm bảo đủ dung lượng ổ cứng trước khi tải

## 🔧 Khắc phục sự cố

### Lỗi không tìm thấy yt-dlp:
```bash
which yt-dlp
# Nếu không có kết quả, chạy lại:
pipx install --force yt-dlp
pipx ensurepath
```

### Lỗi aria2c:
```bash
sudo apt install aria2
```

### Tải chậm:
- Giảm số kết nối: thay `-x 16` thành `-x 8`
- Giảm chunk size: thay `-k 32M` thành `-k 16M`

---

**📞 Hỗ trợ**: Nếu gặp vấn đề, vui lòng tạo issue trong repository này.