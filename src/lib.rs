use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("FP5e6JndLDRFmPS8sNwAwLfoPK8HGkbzspqqDvJRZbnJ");

#[program]
pub mod solana_swap_smartcontract {
    use super::*;

    /// Swap SOL for USDT through a liquidity pool
    pub fn swap_sol_to_usdt(
        ctx: Context<SwapSolToUsdt>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        
        // Validate input amount
        require!(amount_in > 0, SwapError::InvalidAmount);
        
        // Check pool reserves and calculate output amount
        let pool = &ctx.accounts.pool;
        let sol_reserve = pool.sol_reserve;
        let usdt_reserve = pool.usdt_reserve;
        
        // Calculate output amount using constant product formula (x * y = k)
        // amount_out = (amount_in * usdt_reserve) / (sol_reserve + amount_in)
        let amount_out = calculate_swap_output(amount_in, sol_reserve, usdt_reserve)?;
        
        // Check slippage protection
        require!(amount_out >= minimum_amount_out, SwapError::SlippageExceeded);
        
        // Transfer SOL from user to pool
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_sol_account.to_account_info(),
            to: ctx.accounts.pool_sol_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_in)?;
        
        // Transfer USDT from pool to user
        let pool_seeds = &[
            b"pool".as_ref(),
            ctx.accounts.sol_mint.to_account_info().key.as_ref(),
            ctx.accounts.usdt_mint.to_account_info().key.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&pool_seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_usdt_account.to_account_info(),
            to: ctx.accounts.user_usdt_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount_out)?;
        
        // Update pool reserves
        let pool = &mut ctx.accounts.pool;
        pool.sol_reserve = pool.sol_reserve.checked_add(amount_in).ok_or(SwapError::MathOverflow)?;
        pool.usdt_reserve = pool.usdt_reserve.checked_sub(amount_out).ok_or(SwapError::InsufficientLiquidity)?;
        pool.last_update_time = clock.unix_timestamp;
        
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            token_in: ctx.accounts.sol_mint.key(),
            token_out: ctx.accounts.usdt_mint.key(),
            amount_in,
            amount_out,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    /// Swap USDT for SOL through a liquidity pool
    pub fn swap_usdt_to_sol(
        ctx: Context<SwapUsdtToSol>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        
        // Validate input amount
        require!(amount_in > 0, SwapError::InvalidAmount);
        
        // Check pool reserves and calculate output amount
        let pool = &ctx.accounts.pool;
        let sol_reserve = pool.sol_reserve;
        let usdt_reserve = pool.usdt_reserve;
        
        // Calculate output amount using constant product formula
        let amount_out = calculate_swap_output(amount_in, usdt_reserve, sol_reserve)?;
        
        // Check slippage protection
        require!(amount_out >= minimum_amount_out, SwapError::SlippageExceeded);
        
        // Transfer USDT from user to pool
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_usdt_account.to_account_info(),
            to: ctx.accounts.pool_usdt_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_in)?;
        
        // Transfer SOL from pool to user
        let pool_seeds = &[
            b"pool".as_ref(),
            ctx.accounts.sol_mint.to_account_info().key.as_ref(),
            ctx.accounts.usdt_mint.to_account_info().key.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&pool_seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_sol_account.to_account_info(),
            to: ctx.accounts.user_sol_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount_out)?;
        
        // Update pool reserves
        let pool = &mut ctx.accounts.pool;
        pool.usdt_reserve = pool.usdt_reserve.checked_add(amount_in).ok_or(SwapError::MathOverflow)?;
        pool.sol_reserve = pool.sol_reserve.checked_sub(amount_out).ok_or(SwapError::InsufficientLiquidity)?;
        pool.last_update_time = clock.unix_timestamp;
        
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            token_in: ctx.accounts.usdt_mint.key(),
            token_out: ctx.accounts.sol_mint.key(),
            amount_in,
            amount_out,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    /// Initialize a new liquidity pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        initial_sol_amount: u64,
        initial_usdt_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.sol_mint = ctx.accounts.sol_mint.key();
        pool.usdt_mint = ctx.accounts.usdt_mint.key();
        pool.sol_reserve = initial_sol_amount;
        pool.usdt_reserve = initial_usdt_amount;
        pool.bump = ctx.bumps.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.last_update_time = Clock::get()?.unix_timestamp;
        
        Ok(())
    }
}

/// Calculate swap output amount using constant product formula
fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
) -> Result<u64> {
    require!(reserve_in > 0 && reserve_out > 0, SwapError::InsufficientLiquidity);
    
    // Apply 0.3% fee (997/1000)
    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(997)
        .ok_or(SwapError::MathOverflow)?;
    
    let numerator = amount_in_with_fee
        .checked_mul(reserve_out as u128)
        .ok_or(SwapError::MathOverflow)?;
    
    let denominator = (reserve_in as u128)
        .checked_mul(1000)
        .ok_or(SwapError::MathOverflow)?
        .checked_add(amount_in_with_fee)
        .ok_or(SwapError::MathOverflow)?;
    
    let amount_out = numerator
        .checked_div(denominator)
        .ok_or(SwapError::MathOverflow)?;
    
    Ok(amount_out as u64)
}

#[derive(Accounts)]
pub struct SwapSolToUsdt<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"pool", sol_mint.key().as_ref(), usdt_mint.key().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, LiquidityPool>,
    
    pub sol_mint: Account<'info, token::Mint>,
    pub usdt_mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        associated_token::mint = sol_mint,
        associated_token::authority = user,
    )]
    pub user_sol_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = user,
    )]
    pub user_usdt_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = sol_mint,
        associated_token::authority = pool,
    )]
    pub pool_sol_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = pool,
    )]
    pub pool_usdt_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SwapUsdtToSol<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"pool", sol_mint.key().as_ref(), usdt_mint.key().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, LiquidityPool>,
    
    pub sol_mint: Account<'info, token::Mint>,
    pub usdt_mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        associated_token::mint = sol_mint,
        associated_token::authority = user,
    )]
    pub user_sol_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = user,
    )]
    pub user_usdt_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = sol_mint,
        associated_token::authority = pool,
    )]
    pub pool_sol_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = pool,
    )]
    pub pool_usdt_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + LiquidityPool::LEN,
        seeds = [b"pool", sol_mint.key().as_ref(), usdt_mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, LiquidityPool>,
    
    pub sol_mint: Account<'info, token::Mint>,
    pub usdt_mint: Account<'info, token::Mint>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = sol_mint,
        associated_token::authority = pool,
    )]
    pub pool_sol_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdt_mint,
        associated_token::authority = pool,
    )]
    pub pool_usdt_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct LiquidityPool {
    pub sol_mint: Pubkey,
    pub usdt_mint: Pubkey,
    pub sol_reserve: u64,
    pub usdt_reserve: u64,
    pub authority: Pubkey,
    pub bump: u8,
    pub last_update_time: i64,
}

impl LiquidityPool {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 32 + 1 + 8;
}

#[event]
pub struct SwapEvent {
    pub user: Pubkey,
    pub token_in: Pubkey,
    pub token_out: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum SwapError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Math overflow")]
    MathOverflow,
}
