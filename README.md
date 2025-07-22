# Solana Swap Smart Contract

Smart contract Solan### Build và Deploy

⚠️ **Quan trọng**: Phải build smart contract trước để tạo TypeScript types!

### Build smart contract

```bash
# Build smart contract và tạo types
yarn build

# Hoặc chỉ build anchor
yarn build-only
```

### Deploy lên localnet

```bash
# Terminal 1: Start validator
yarn localnet

# Terminal 2: Deploy
yarn deploy
```

### Chạy tests

```bash
yarn test
```

## 🔧 Troubleshooting

### Lỗi TypeScript Import

Nếu gặp lỗi `Cannot find module '../target/types/solana_swap_smartcontract'`:

1. **Build smart contract trước**: `yarn build`
2. **Xem hướng dẫn chi tiết**: [TYPESCRIPT_SETUP.md](./TYPESCRIPT_SETUP.md)

File types chỉ được tạo sau khi build smart contract thành công. SOL/USDT thông qua liquidity pool.

## Tính năng

- Swap SOL sang USDT
- Swap USDT sang SOL  
- Tạo và quản lý liquidity pool
- Tính toán giá theo công thức constant product (x * y = k)
- Bảo vệ slippage
- Fee 0.3% cho mỗi giao dịch

## Cài đặt

### Yêu cầu

- Rust 1.70+
- Solana CLI 1.17+
- Anchor Framework 0.29+
- Node.js 18+
- Yarn hoặc NPM

### Cài đặt dependencies

```bash
# Cài đặt Rust và Solana
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Cài đặt Anchor
npm install -g @coral-xyz/anchor-cli

# Cài đặt dependencies của project
yarn install
```

### Thiết lập Solana CLI

```bash
# Tạo keypair mới (nếu chưa có)
solana-keygen new

# Cấu hình để sử dụng localnet
solana config set --url localhost

# Start localnet validator
solana-test-validator
```

## Build và Deploy

### Build smart contract

```bash
anchor build
```

### Deploy lên localnet

```bash
anchor deploy
```

### Chạy tests

```bash
anchor test
```

## Cách sử dụng

### 1. Khởi tạo Liquidity Pool

```typescript
import { SwapClient } from './src/client';

const swapClient = new SwapClient(connection, wallet, programId);

// Tạo pool với 50 SOL và 5000 USDT (tỷ lệ 1:100)
await swapClient.initializePool(
  authority,
  solMint,
  usdtMint,
  50,    // 50 SOL
  5000   // 5000 USDT
);
```

### 2. Swap SOL sang USDT

```typescript
// Swap 1 SOL, tối thiểu nhận 95 USDT
await swapClient.swapSolToUsdt(
  userKeypair,
  solMint,
  usdtMint,
  1,     // 1 SOL
  95     // Minimum 95 USDT
);
```

### 3. Swap USDT sang SOL

```typescript
// Swap 100 USDT, tối thiểu nhận 0.9 SOL
await swapClient.swapUsdtToSol(
  userKeypair,
  solMint,
  usdtMint,
  100,   // 100 USDT
  0.9    // Minimum 0.9 SOL
);
```

### 4. Kiểm tra thông tin pool

```typescript
const poolInfo = await swapClient.getPoolInfo(solMint, usdtMint);
console.log("SOL Reserve:", poolInfo.solReserve.toNumber());
console.log("USDT Reserve:", poolInfo.usdtReserve.toNumber());

// Lấy giá hiện tại
const price = await swapClient.getCurrentPrice(solMint, usdtMint);
console.log("1 SOL =", price, "USDT");
```

## Cấu trúc Smart Contract

### Chương trình chính

- `swap_sol_to_usdt`: Swap SOL sang USDT
- `swap_usdt_to_sol`: Swap USDT sang SOL  
- `initialize_pool`: Khởi tạo liquidity pool

### Accounts

- `LiquidityPool`: Lưu trữ thông tin pool (reserves, authority, etc.)
- Token accounts cho SOL và USDT của pool và user

### Tính toán giá

Sử dụng công thức Automated Market Maker (AMM):

```
amount_out = (amount_in * reserve_out) / (reserve_in + amount_in)
```

Với fee 0.3%:
```
amount_in_with_fee = amount_in * 0.997
amount_out = (amount_in_with_fee * reserve_out) / (reserve_in + amount_in_with_fee)
```

## Bảo mật

- ✅ Kiểm tra slippage protection
- ✅ Kiểm tra overflow/underflow
- ✅ Xác thực quyền sở hữu token accounts
- ✅ Sử dụng PDA cho pool authority
- ✅ Emit events cho tracking

## Testnet/Mainnet

Để deploy lên testnet hoặc mainnet:

1. Cập nhật `Anchor.toml`:
```toml
[provider]
cluster = "devnet"  # hoặc "mainnet-beta"
```

2. Cập nhật program ID:
```bash
anchor keys list
# Cập nhật ID trong lib.rs và Anchor.toml
```

3. Deploy:
```bash
anchor deploy --provider.cluster devnet
```

## Lưu ý quan trọng

⚠️ **Đây là code demo, chưa được audit. Không sử dụng trên mainnet với số tiền lớn.**

- Test kỹ trên devnet trước
- Kiểm tra security audit
- Implement additional safety checks
- Cân nhắc sử dụng oracle cho price feeds
- Implement time-weighted average price (TWAP)

## Hỗ trợ

Nếu có câu hỏi hoặc gặp vấn đề, tạo issue trên GitHub repo này.
