# 🚀 Git Workflow Guidelines

## 🧭 Mục tiêu
Quy trình này giúp đội phát triển làm việc hiệu quả, giảm xung đột và đảm bảo **chất lượng code** trước khi merge vào nhánh `main` — nơi dùng để build product.

---

## 🌳 Cấu trúc nhánh chính
- **main** → Nhánh chính để build product (❗ chỉ người chịu trách nhiệm build mới có quyền merge).
- **develop** → Nhánh dành cho phát triển và test tổng hợp.
- **feature/** → Nhánh con dành cho từng lập trình viên khi phát triển tính năng cụ thể.

---

## ⚙️ Quy trình làm việc chuẩn

### 1️⃣ Clone project lần đầu
```bash
git clone <repo-url>
cd <project-folder>
git checkout develop
```

### 2️⃣ Tạo nhánh cá nhân để phát triển
Mỗi dev sẽ tạo nhánh theo cú pháp:
```
feature/<tên-dev>-<mô-tả-ngắn>
```

Ví dụ:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/zin-trim-video
```

### 3️⃣ Commit code thường xuyên
- Ghi rõ nội dung commit.
- Sử dụng ngôi thứ nhất (tôi, tôi đã) hoặc động từ ngắn gọn (add, fix, refactor).

Ví dụ:
```bash
git add .
git commit -m "fix: chỉnh lại width video khi crop"
git push origin feature/zin-trim-video
```

### 4️⃣ Tạo Pull Request (PR)
- PR từ `feature/...` → `develop`
- Ghi rõ **nội dung thay đổi**, **ảnh hưởng**, **hướng dẫn test**.
- Gắn tag người review (nếu có).

Sau khi code được review và merge, **xóa branch feature** trên remote.

### 5️⃣ Merge từ develop → main
Chỉ **Tech Lead / Owner** có quyền merge để build product.

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

---

## 🧩 Quy ước đặt tên nhánh & commit

| Loại nhánh | Cú pháp ví dụ | Ghi chú |
|-------------|----------------|---------|
| Feature | `feature/zin-upload-video` | Tính năng mới |
| Fix | `fix/zin-video-timeline` | Sửa lỗi |
| Hotfix | `hotfix/zin-deploy-bug` | Khắc phục khẩn cấp |
| Refactor | `refactor/zin-common-utils` | Tối ưu code |

---

## 🧑‍💻 Gợi ý khi làm việc nhóm
- Luôn **pull develop** mới nhất trước khi bắt đầu code.
- Không commit file build (`dist`, `node_modules`, `.env`, v.v.).
- Dùng `.gitignore` để tránh commit nhầm file.
- Khi conflict, **tự resolve và test lại** trước khi push.

---

## ✅ Checklist trước khi merge PR
- [ ] Code đã chạy ổn định, không lỗi console.
- [ ] Không còn `console.log` hoặc `debugger`.
- [ ] Đã pull `develop` mới nhất trước khi push.
- [ ] Đã tự test cẩn thận trên giao diện thật.

---

## 🏁 Tổng kết
Quy trình giúp:
- Dễ quản lý lịch sử code.
- Hạn chế xung đột giữa devs.
- Đảm bảo chỉ code sạch mới được merge vào `main`.

> 💡 Mọi thay đổi quy trình cần được Tech Lead duyệt trước khi áp dụng.

---

✍️ **Maintainer:** Zin  
🕓 **Cập nhật:** 2025-10-12
