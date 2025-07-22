#!/bin/bash

echo "🔧 Setting up Solana Swap Smart Contract..."

# Kiểm tra Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source ~/.cargo/env
fi

# Kiểm tra Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Kiểm tra Anchor
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor not found. Installing Anchor..."
    npm install -g @coral-xyz/anchor-cli
fi

# Cài đặt Node dependencies
echo "📦 Installing Node.js dependencies..."
yarn install

# Thiết lập Solana config
echo "⚙️ Setting up Solana configuration..."
solana config set --url localhost

# Tạo keypair nếu chưa có
if [ ! -f ~/.config/solana/id.json ]; then
    echo "🔑 Creating new Solana keypair..."
    solana-keygen new --no-bip39-passphrase
fi

echo "✅ Setup completed!"
echo ""
echo "🚀 Next steps:"
echo "1. Start local validator: yarn localnet"
echo "2. Build contract: yarn build"
echo "3. Deploy contract: yarn deploy"
echo "4. Run tests: yarn test"
