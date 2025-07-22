#!/bin/bash

echo "🏗️ Building Solana smart contract..."

# Build the smart contract
anchor build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Smart contract built successfully!"
    
    # Copy IDL to src for easier importing
    if [ -f "target/idl/solana_swap_smartcontract.json" ]; then
        cp target/idl/solana_swap_smartcontract.json src/
        echo "📄 IDL copied to src directory"
    fi
    
    # Generate types if anchor generated them
    if [ -f "target/types/solana_swap_smartcontract.ts" ]; then
        cp target/types/solana_swap_smartcontract.ts src/generated-types.ts
        echo "🏷️ Types copied to src directory"
    fi
    
    echo ""
    echo "🎉 Build completed! Next steps:"
    echo "1. Deploy: yarn deploy"
    echo "2. Test: yarn test"
    echo "3. Run demo: yarn demo"
else
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi
