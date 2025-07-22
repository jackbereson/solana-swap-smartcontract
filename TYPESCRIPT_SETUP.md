# 🔧 Hướng dẫn Fix Lỗi TypeScript Import

## ❌ Vấn đề

Bạn đang gặp lỗi:
```
Cannot find module '../target/types/solana_swap_smartcontract'
```

## 🔍 Nguyên nhân

File type definition cho smart contract chỉ được tạo sau khi build smart contract với Anchor. Hiện tại chúng ta chưa build nên file này chưa tồn tại.

## ✅ Giải pháp

### Bước 1: Cài đặt dependencies
```bash
yarn install
```

### Bước 2: Setup môi trường (nếu chưa làm)
```bash
yarn setup
```

### Bước 3: Build smart contract
```bash
yarn build
```

Hoặc chỉ build anchor:
```bash
yarn build-only
```

### Bước 4: Kiểm tra files được tạo
Sau khi build thành công, bạn sẽ thấy:
- `target/types/solana_swap_smartcontract.ts` - Type definitions
- `target/idl/solana_swap_smartcontract.json` - IDL file
- `src/generated-types.ts` - Copy của types (được tự động tạo)

## 🚀 Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Build everything
yarn build

# 3. Deploy (cần start localnet trước)
# Terminal 1:
yarn localnet

# Terminal 2:
yarn deploy

# 4. Test
yarn test
```

## 📝 Tạm thời sử dụng

Hiện tại tôi đã tạo sẵn file `src/types.ts` với type definitions để code có thể compile được ngay. Khi bạn build smart contract thành công, file types thực sự sẽ được tạo.

## 🔄 Workflow Development

1. **Sửa smart contract** (`src/lib.rs`)
2. **Build lại**: `yarn build`
3. **Deploy**: `yarn deploy`
4. **Test**: `yarn test`

## ⚠️ Lưu ý

- File `src/types.ts` là temporary, sau khi build thành công sẽ dùng file từ `target/types/`
- Mỗi lần thay đổi smart contract phải build lại
- Ensure Solana validator đang chạy trước khi deploy

## 🆘 Troubleshooting

### Lỗi: "anchor command not found"
```bash
npm install -g @coral-xyz/anchor-cli
```

### Lỗi: "solana command not found"
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### Lỗi: Build failed
1. Kiểm tra Rust version: `rustc --version`
2. Update Rust: `rustup update`
3. Clean và build lại: `yarn clean && yarn build`

## 📚 Resources

- [Anchor Documentation](https://anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [TypeScript Anchor Guide](https://anchor-lang.com/docs/typescript)
