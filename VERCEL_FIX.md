# Khắc phục lỗi deploy Vercel

## Các vấn đề đã được khắc phục:

### 1. **Lỗi TypeScript Build**
- ❌ **Lỗi**: `'getRegionResultUrl' is declared but its value is never read`
- ❌ **Lỗi**: `'currentXsmnDaySlug' is declared but its value is never read`  
- ❌ **Lỗi**: `'WEEKDAY_TO_DAY_SLUG' is declared but its value is never read`
- ✅ **Giải pháp**: Xóa các function và constant không sử dụng

### 2. **Cấu hình Vercel**
- ✅ **Sửa vercel.json**: Loại bỏ functions config không cần thiết
- ✅ **Sửa package.json**: Cập nhật TypeScript và Vite versions
- ✅ **Sửa vite.config.ts**: Tối ưu proxy config cho production

### 3. **API Routes CORS**
- ✅ **Thêm CORS headers** vào tất cả API endpoints
- ✅ **Xử lý OPTIONS requests** cho preflight
- ✅ **Tối ưu error handling** cho serverless environment

## Các file đã được sửa:

### Cấu hình:
- `vercel.json` - Cấu hình Vercel deployment
- `package.json` - Cập nhật dependencies versions
- `vite.config.ts` - Tối ưu cho production build
- `src/App.tsx` - Xóa unused code

### API Routes (đã thêm CORS):
- `api/province.js` - **API chính cho lọc tỉnh thành**
- `api/proxy.js` - API proxy
- `api/results.js` - API kết quả xổ số  
- `api/stats.js` - API thống kê
- `api/home.js` - API trang chủ
- `api/phan-tich.js` - API phân tích
- `api/vietlott.js` - API Vietlott
- `api/thong-ke.js` - API thống kê

## Trạng thái hiện tại:

✅ **Build local thành công**
✅ **TypeScript compile OK**  
✅ **Vite build OK**
✅ **Code đã được push lên GitHub**

## Bước tiếp theo:

1. **Vercel sẽ tự động deploy** từ GitHub
2. **Kiểm tra deployment logs** trên Vercel dashboard
3. **Test tính năng lọc tỉnh thành** sau khi deploy xong

## Cách test sau khi deploy:

1. Truy cập website trên Vercel URL
2. Click vào một tỉnh thành trong sidebar (ví dụ: "TP Hồ Chí Minh")
3. Kiểm tra xem dữ liệu có load đúng không
4. Mở DevTools > Network tab để xem API calls
5. Đảm bảo không có CORS errors

## Lưu ý:

- **API endpoint chính**: `/api/province?region=mien-nam&slug=tp-hcm`
- **Data source**: `minhngoc.net.vn` 
- **Timeout**: Vercel serverless functions có timeout 10s
- **Caching**: API responses được cache 5 phút

Tính năng lọc theo tỉnh thành bây giờ sẽ hoạt động bình thường trên Vercel!