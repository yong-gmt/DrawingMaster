# ติดตั้งและเริ่มทำงาน

## สิ่งที่ต้องมี

| | |
|---|---|
| Node.js 18+ | รันชุดทดสอบ |
| Python 3.9+ | สคริปต์ build |
| Chromium | Playwright ติดตั้งให้เอง |
| ezdxf | ตรวจไฟล์ที่ export ด้วยไลบรารีอื่น |

## ขั้นตอน

```bash
cd drawing-master
git init && git add -A && git commit -m "Drawing Master"

npm install
npx playwright install chromium
pip install ezdxf                       # หรือ pip install ezdxf --break-system-packages

python3 scripts/build.py                # -> drawing-master/DrawingMaster.html
node tests/t_model.js                   # ลองสักตัว
```

เปิดแอป:

```bash
open drawing-master/DrawingMaster.html   # macOS
xdg-open drawing-master/DrawingMaster.html   # Linux
start build\DrawingMaster.html          # Windows
```

> **ข้อควรระวัง:** เปิดแบบ `file://` เบราว์เซอร์บางตัวจำกัดการเก็บข้อมูล
> ถ้าเจอว่าโปรเจกต์ไม่ถูกบันทึก ให้เปิดผ่าน VS Code Live Server
> หรือ `python3 -m http.server` แล้วเข้าทาง `http://localhost:8000/drawing-master/`

## Claude Code

```bash
cd drawing-master
claude
```

`CLAUDE.md` ถูกอ่านอัตโนมัติ — บอก Claude ว่า build ยังไง ทดสอบยังไง
และกฎที่โปรเจกต์นี้ยึด

**คำสั่งที่เข้ากับโปรเจกต์นี้**

```
อ่าน docs/ANALYSIS.md แล้วสรุปว่ายังเหลืออะไร
ทำ angular dimension ให้มีโมเดล เขียนเทสต์ที่วัดจากเส้นที่วาดจริง
รัน bash scripts/test.sh แล้วบอกว่าตัวไหนไม่ผ่านและทำไม
แยก CSS ออกจาก src/base.html โดยเทสต์ต้องผ่านครบเหมือนเดิม
```

**สองนิสัยที่ควรรักษาไว้**

- **ขอตัวเลข ไม่ใช่คำตัดสิน** — "รันเทสต์แล้วบอกตัวเลขมา" ดีกว่า "แก้ให้หน่อย"
  โค้ดชุดนี้มีประวัติยาวของการแก้ที่ผ่านทุกการตรวจแล้วยังผิดอยู่บนจอ
- **หนึ่งเรื่องต่อหนึ่งรอบ** — รอบที่รวมหกเรื่องเข้าด้วยกัน ย้อนกลับไม่ได้เมื่อมีอันหนึ่งพัง

## VS Code

```bash
code drawing-master
```

`Ctrl/Cmd+Shift+B` = build · `Terminal → Run Task → Test (all)` = ทดสอบทั้งชุด

ส่วนขยายที่แนะนำอยู่ใน `.vscode/extensions.json` แล้ว — VS Code จะถามให้เอง

## เมื่อแก้อะไรสักอย่าง

```
1. แก้ src/modules/*.js  หรือเพิ่ม rep() ใน scripts/build.py
2. python3 scripts/build.py            ← ต้องขึ้น "patched ok"
3. รันเทสต์ที่เกี่ยวข้อง
4. เขียนเทสต์ใหม่ที่ "วัด" สิ่งที่เพิ่งแก้ — ถ้าไม่มี มันจะพังอีกโดยไม่มีใครรู้
5. bash scripts/test.sh                ← ก่อน commit
```

**ถ้า build ขึ้น AssertionError** แปลว่า `rep()` หา string เป้าหมายไม่เจอหรือเจอเกินหนึ่งที่
อย่าแก้ด้วยการลบ assert — ไปดูว่า `src/base.html` เปลี่ยนไปตรงไหน
