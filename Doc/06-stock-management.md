# Stock Management System

## Overview
ระบบจัดการสต๊อกสินค้า — ติดตามสินค้าคงเหลือ, แจ้งเตือนสต๊อกต่ำ, ประวัติการเคลื่อนไหว

## Data Model

### Product.json fields
| Field | Type | Description |
|-------|------|-------------|
| `price` | number | ราคาขาย |
| `purchasePrice` | number | ราคาซื้อ (ต้นทุน) |
| `stockEnabled` | boolean | เปิด/ปิดระบบสต๊อก |
| `stockQty` | number | จำนวนคงเหลือ |
| `minStock` | number | จุดสั่งซื้อ (แจ้งเตือนเมื่อเหลือน้อยกว่า) |
| `stockLogs` | StockLog[] | ประวัติการเคลื่อนไหวสต๊อก |

### StockLog
```typescript
interface StockLog {
  date: string;      // ISO date
  qty: number;       // จำนวน
  type: 'IN' | 'OUT' | 'ADJUST';
  reason: string;
  refDocNo?: string; // เลขที่เอกสารอ้างอิง
}
```

## Pages

### Products Page (`/products`)
- **KPI Cards**: จำนวนสินค้าทั้งหมด, มูลค่าสต๊อก, เปิดสต๊อก, สต๊อกต่ำ/หมด
- **Filters**: หมวดหมู่ (dropdown), สถานะสต๊อก (ทั้งหมด/เปิดสต๊อก/ต่ำ/หมด)
- **Table Columns**: รหัส, ชื่อ, หน่วย, ราคาขาย, ราคาซื้อ, สต๊อก, หมวด
- **Actions**: ปรับสต๊อก (IN/OUT/ADJUST), แก้ไข, ลบ

### Purchases Page (`/purchases`)
- Form สำหรับรับสินค้าเข้าสต๊อก
- เลือกสินค้า → auto-fill `purchasePrice` เป็น unitCost
- ปุ่ม "ออกใบสั่งซื้อ (PO)" → navigate to `/documents?type=PO`
- ประวัติรับสินค้าล่าสุด

### Dashboard (`/`)
- KPI: สินค้าในสต๊อก, มูลค่าสต๊อก, สินค้าใกล้หมด
- ตารางสินค้าสต๊อกต่ำ พร้อมลิงก์ "สั่งซื้อเพิ่ม"

## Stock Adjustment Types
| Type | Description | Effect |
|------|-------------|--------|
| IN | รับเข้า | currentQty + qty |
| OUT | เบิกออก | currentQty - qty |
| ADJUST | ตั้งค่าใหม่ | = qty |

## Auto Stock Deduction
เมื่อออกใบส่งของ (DO) จะหักสต๊อกอัตโนมัติ สำหรับสินค้าที่เปิดระบบสต๊อก
