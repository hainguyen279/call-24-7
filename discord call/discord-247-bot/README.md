# Discord Bot Treo Voice 24/7 — điều khiển bằng lệnh `!add`

Chỉ cần vào channel bất kỳ trong server, đang ở trong 1 voice channel, gõ **`!add`** → bot tự vào đúng voice channel đó và ở lại 24/7. Gõ **`!leave`** để bot rời đi.

## 1. Tạo Discord Bot

1. Vào https://discord.com/developers/applications → **New Application** → đặt tên.
2. Tab **Bot** → **Reset Token** → copy (đây là `DISCORD_TOKEN`, giữ bí mật).
3. Trong tab **Bot**, phần **Privileged Gateway Intents**, **bật (ON) mục "MESSAGE CONTENT INTENT"** — bắt buộc để bot đọc được lệnh `!add`.
4. Tab **OAuth2 → URL Generator**:
   - Scopes: tick `bot`
   - Bot Permissions: tick `Connect`, `Speak`, `Send Messages`, `Read Message History`, `View Channels`
   - Copy link → mở trình duyệt → chọn server → Authorize.

## 2. Chạy thử ở local (tùy chọn)

```bash
npm install
cp .env.example .env
# Điền DISCORD_TOKEN vào .env
npm start
```

Sau đó vào Discord, vô 1 voice channel bất kỳ, gõ `!add` ở kênh chat.

## 3. Đưa lên GitHub

```bash
git init
git add .
git commit -m "Discord 24/7 voice bot voi lenh !add"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 4. Deploy lên Render

1. https://render.com → đăng nhập GitHub → **New +** → **Web Service**.
2. Chọn repo vừa tạo.
3. Cấu hình:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
4. Tab **Environment** → thêm biến `DISCORD_TOKEN` = token bot của bạn (không cần GUILD_ID/VOICE_CHANNEL_ID nữa vì đã có lệnh `!add`).
5. **Create Web Service**.

### Lưu ý về gói Free của Render
- Web Service Free sẽ tự **sleep sau ~15 phút** không có HTTP request → bot rớt khỏi voice. Dùng [UptimeRobot](https://uptimerobot.com) (miễn phí) ping vào URL của Render mỗi 5–10 phút để giữ service luôn "thức", hoặc nâng gói Starter (trả phí, không sleep).
- Ổ đĩa trên Render free là **ephemeral** — file `target.json` (lưu channel bot đã join) có thể bị xóa mỗi khi bạn **deploy lại code mới**. Sau mỗi lần deploy mới, chỉ cần gõ lại `!add` một lần là xong. Việc bot **tự khởi động lại do sleep/crash bình thường** (không deploy code mới) thì `target.json` vẫn còn, bot tự vào lại voice không cần gõ lệnh.

## 5. Cách dùng hằng ngày

| Lệnh | Tác dụng |
|---|---|
| `!add` | Bot vào đúng voice channel bạn đang đứng, ở lại 24/7 |
| `!leave` | Bot rời voice channel |

Muốn đổi tên lệnh, chỉnh biến `COMMAND_PREFIX` / `LEAVE_COMMAND` trong Environment của Render.

## 6. Kiểm tra log

Render Dashboard → tab **Logs**:
```
🌐 HTTP server đang chạy ở port ...
🤖 Đăng nhập thành công với tên: ...
✅ Đã vào voice channel: ...
```

Nếu gõ `!add` mà bot không phản hồi: kiểm tra lại đã bật **MESSAGE CONTENT INTENT** ở bước 1.3 chưa, và bot đã được mời đúng vào server đó chưa.
