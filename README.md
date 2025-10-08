# Hệ Thống Đặt Lịch Khám Bệnh

Ứng dụng web đầy đủ cho việc quản lý đặt lịch khám bệnh giữa bệnh nhân và bác sĩ.

## 🌟 Tính Năng

### Cho Bệnh Nhân
- ✅ Đăng ký/đăng nhập tài khoản
- ✅ Tìm kiếm bác sĩ theo chuyên khoa
- ✅ Xem thông tin chi tiết bác sĩ (kinh nghiệm, phí khám)
- ✅ Xem lịch trống của bác sĩ
- ✅ Đặt lịch khám với ngày giờ cụ thể
- ✅ Quản lý lịch hẹn (xem danh sách, hủy lịch)
- ✅ Theo dõi trạng thái lịch hẹn (chờ xác nhận, đã xác nhận, hoàn thành, đã hủy)

### Cho Bác Sĩ
- ✅ Đăng ký/đăng nhập tài khoản
- ✅ Tạo hồ sơ bác sĩ (chuyên khoa, kinh nghiệm, phí khám, mô tả)
- ✅ Quản lý lịch làm việc (8h-17h, mỗi slot 30 phút)
- ✅ Xem danh sách lịch hẹn
- ✅ Xác nhận/từ chối lịch hẹn
- ✅ Hoàn thành khám bệnh và thêm ghi chú

## 🛠 Tech Stack

- **Backend**: FastAPI + Python + MongoDB + JWT Authentication
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui
- **Database**: MongoDB với Motor (async driver)

## 🚀 Chạy Ứng Dụng

Ứng dụng đã được cấu hình với supervisor và sẵn sàng sử dụng:

```bash
# Restart all services
sudo supervisorctl restart all

# Check status
sudo supervisorctl status
```

- **Frontend**: https://functional-site-3.preview.emergentagent.com
- **Backend API**: https://functional-site-3.preview.emergentagent.com/api

## 👤 Tài Khoản Demo

### Bệnh Nhân
- Username: `patient1`
- Password: `password123`

### Bác Sĩ
- Username: `doctor1`
- Password: `password123`

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Doctors
- `GET /api/doctors?specialty=<specialty>` - Danh sách bác sĩ
- `GET /api/doctors/{id}` - Chi tiết bác sĩ
- `POST /api/doctors/profile` - Tạo profile bác sĩ
- `POST /api/doctors/schedule` - Tạo lịch làm việc
- `GET /api/doctors/{id}/available-slots?date=YYYY-MM-DD` - Xem slot trống

### Appointments
- `POST /api/appointments` - Đặt lịch mới
- `GET /api/appointments/my-appointments` - Xem lịch hẹn của mình
- `PATCH /api/appointments/{id}` - Cập nhật trạng thái
- `DELETE /api/appointments/{id}` - Hủy lịch hẹn

## 📁 Cấu Trúc Project

```
/app
├── backend/
│   ├── server.py          # Main FastAPI app
│   ├── models.py          # Data models
│   ├── auth.py            # JWT authentication
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── contexts/AuthContext.js
│   │   ├── pages/
│   │   │   ├── AuthPage.js
│   │   │   ├── PatientDashboard.js
│   │   │   └── DoctorDashboard.js
│   │   └── components/
│   └── package.json
└── README.md
