use anchor_lang::prelude::*;

declare_id!("9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP");

#[program]
pub mod proof_of_battle {
    use super::*;

    pub fn register_robot(
        ctx: Context<RegisterRobot>,
        name: String,
        attack: u8,
        defense: u8,
        speed: u8,
    ) -> Result<()> {
        require!(name.len() <= 32, PoBError::NameTooLong);
        require!(attack <= 100 && defense <= 100 && speed <= 100, PoBError::InvalidStats);

        let robot = &mut ctx.accounts.robot;
        robot.owner = ctx.accounts.owner.key();
        robot.name = name;
        robot.attack = attack;
        robot.defense = defense;
        robot.speed = speed;
        robot.wins = 0;
        robot.losses = 0;
        robot.hp = 100;
        robot.is_active = true;
        robot.bump = ctx.bumps.robot;

        emit!(RobotRegistered {
            owner: robot.owner,
            name: robot.name.clone(),
            attack,
            defense,
            speed,
        });

        Ok(())
    }

    pub fn create_battle(
        ctx: Context<CreateBattle>,
        battle_id: u64,
        entry_fee: u64,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle;
        battle.battle_id = battle_id;
        battle.robot_a = ctx.accounts.robot_a.key();
        battle.robot_b = ctx.accounts.robot_b.key();
        battle.owner_a = ctx.accounts.creator.key();
        battle.entry_fee = entry_fee;
        battle.total_bets_a = 0;
        battle.total_bets_b = 0;
        battle.hp_a = 100;
        battle.hp_b = 100;
        battle.status = BattleStatus::Waiting;
        battle.winner = None;
        battle.bump = ctx.bumps.battle;

        emit!(BattleCreated {
            battle_id,
            robot_a: battle.robot_a,
            robot_b: battle.robot_b,
        });

        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        battle_id: u64,
        side: u8,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, PoBError::InvalidBetAmount);
        require!(side == 0 || side == 1, PoBError::InvalidSide);

        let battle = &mut ctx.accounts.battle;
        require!(battle.status == BattleStatus::Waiting, PoBError::BattleNotOpen);

        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.bettor.key(),
            &ctx.accounts.vault.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.bettor.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        let bet = &mut ctx.accounts.bet;
        bet.bettor = ctx.accounts.bettor.key();
        bet.battle_id = battle_id;
        bet.side = side;
        bet.amount = amount;
        bet.claimed = false;
        bet.bump = ctx.bumps.bet;

        if side == 0 {
            battle.total_bets_a = battle.total_bets_a.checked_add(amount).unwrap();
        } else {
            battle.total_bets_b = battle.total_bets_b.checked_add(amount).unwrap();
        }

        emit!(BetPlaced {
            bettor: bet.bettor,
            battle_id,
            side,
            amount,
        });

        Ok(())
    }

    pub fn start_battle(ctx: Context<StartBattle>, _battle_id: u64) -> Result<()> {
        let battle = &mut ctx.accounts.battle;
        require!(battle.status == BattleStatus::Waiting, PoBError::BattleNotOpen);
        battle.status = BattleStatus::Active;

        emit!(BattleStarted { battle_id: battle.battle_id });

        Ok(())
    }

    pub fn report_damage(
        ctx: Context<ReportDamage>,
        battle_id: u64,
        target: u8,
        damage: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle;
        require!(battle.status == BattleStatus::Active, PoBError::BattleNotActive);
        require!(target == 0 || target == 1, PoBError::InvalidSide);
        require!(damage <= 50, PoBError::InvalidDamage);

        if target == 0 {
            battle.hp_a = battle.hp_a.saturating_sub(damage);
        } else {
            battle.hp_b = battle.hp_b.saturating_sub(damage);
        }

        emit!(DamageReported {
            battle_id,
            target,
            damage,
            hp_a: battle.hp_a,
            hp_b: battle.hp_b,
        });

        Ok(())
    }

    pub fn resolve_battle(
        ctx: Context<ResolveBattle>,
        battle_id: u64,
        winner_side: u8,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle;
        require!(battle.status == BattleStatus::Active, PoBError::BattleNotActive);
        require!(winner_side == 0 || winner_side == 1, PoBError::InvalidSide);

        battle.status = BattleStatus::Finished;
        battle.winner = Some(winner_side);

        let robot_a = &mut ctx.accounts.robot_a;
        let robot_b = &mut ctx.accounts.robot_b;
        if winner_side == 0 {
            robot_a.wins += 1;
            robot_b.losses += 1;
        } else {
            robot_b.wins += 1;
            robot_a.losses += 1;
        }

        emit!(BattleResolved {
            battle_id,
            winner_side,
            hp_a: battle.hp_a,
            hp_b: battle.hp_b,
        });

        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, battle_id: u64) -> Result<()> {
        let battle = &ctx.accounts.battle;
        let bet = &mut ctx.accounts.bet;

        require!(battle.status == BattleStatus::Finished, PoBError::BattleNotFinished);
        require!(!bet.claimed, PoBError::AlreadyClaimed);
        require!(bet.battle_id == battle_id, PoBError::WrongBattle);

        let winner = battle.winner.ok_or(PoBError::NoWinner)?;
        require!(bet.side == winner, PoBError::DidNotWin);

        let total_pool = battle.total_bets_a.checked_add(battle.total_bets_b).unwrap();
        let winning_pool = if winner == 0 { battle.total_bets_a } else { battle.total_bets_b };

        let payout = (bet.amount as u128)
            .checked_mul(total_pool as u128).unwrap()
            .checked_mul(95).unwrap()
            .checked_div(winning_pool as u128).unwrap()
            .checked_div(100).unwrap() as u64;

        **ctx.accounts.vault.try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.bettor.try_borrow_mut_lamports()? += payout;

        bet.claimed = true;

        emit!(WinningsClaimed {
            bettor: bet.bettor,
            battle_id,
            payout,
        });

        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterRobot<'info> {
    #[account(
        init,
        payer = owner,
        space = Robot::LEN,
        seeds = [b"robot", owner.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub robot: Account<'info, Robot>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct CreateBattle<'info> {
    #[account(
        init,
        payer = creator,
        space = Battle::LEN,
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump
    )]
    pub battle: Account<'info, Battle>,
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"vault", battle_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: PDA vault para guardar SOL de apuestas
    pub vault: UncheckedAccount<'info>,
    #[account(constraint = robot_a.owner == creator.key() @ PoBError::NotRobotOwner)]
    pub robot_a: Account<'info, Robot>,
    pub robot_b: Account<'info, Robot>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64, side: u8, amount: u64)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump = battle.bump
    )]
    pub battle: Account<'info, Battle>,
    #[account(
        init,
        payer = bettor,
        space = Bet::LEN,
        seeds = [b"bet", battle_id.to_le_bytes().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(
        mut,
        seeds = [b"vault", battle_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: PDA vault
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub bettor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct StartBattle<'info> {
    #[account(
        mut,
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump = battle.bump
    )]
    pub battle: Account<'info, Battle>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct ReportDamage<'info> {
    #[account(
        mut,
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump = battle.bump
    )]
    pub battle: Account<'info, Battle>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct ResolveBattle<'info> {
    #[account(
        mut,
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump = battle.bump
    )]
    pub battle: Account<'info, Battle>,
    #[account(mut)]
    pub robot_a: Account<'info, Robot>,
    #[account(mut)]
    pub robot_b: Account<'info, Robot>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(battle_id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [b"battle", battle_id.to_le_bytes().as_ref()],
        bump = battle.bump
    )]
    pub battle: Account<'info, Battle>,
    #[account(
        mut,
        seeds = [b"bet", battle_id.to_le_bytes().as_ref(), bettor.key().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(
        mut,
        seeds = [b"vault", battle_id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: PDA vault
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub bettor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Robot {
    pub owner: Pubkey,      // 32
    pub name: String,       // 4 + 32
    pub attack: u8,         // 1
    pub defense: u8,        // 1
    pub speed: u8,          // 1
    pub wins: u32,          // 4
    pub losses: u32,        // 4
    pub hp: u8,             // 1
    pub is_active: bool,    // 1
    pub bump: u8,           // 1
}

impl Robot {
    pub const LEN: usize = 8 + 32 + (4 + 32) + 1 + 1 + 1 + 4 + 4 + 1 + 1 + 1;
}

#[account]
pub struct Battle {
    pub battle_id: u64,         // 8
    pub robot_a: Pubkey,        // 32
    pub robot_b: Pubkey,        // 32
    pub owner_a: Pubkey,        // 32
    pub entry_fee: u64,         // 8
    pub total_bets_a: u64,      // 8
    pub total_bets_b: u64,      // 8
    pub hp_a: u8,               // 1
    pub hp_b: u8,               // 1
    pub status: BattleStatus,   // 1
    pub winner: Option<u8>,     // 2
    pub bump: u8,               // 1
}

impl Battle {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 2 + 1;
}

#[account]
pub struct Bet {
    pub bettor: Pubkey,     // 32
    pub battle_id: u64,     // 8
    pub side: u8,           // 1
    pub amount: u64,        // 8
    pub claimed: bool,      // 1
    pub bump: u8,           // 1
}

impl Bet {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 1 + 1;
}

// ─── Enums ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum BattleStatus {
    Waiting,
    Active,
    Finished,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct RobotRegistered { pub owner: Pubkey, pub name: String, pub attack: u8, pub defense: u8, pub speed: u8 }

#[event]
pub struct BattleCreated { pub battle_id: u64, pub robot_a: Pubkey, pub robot_b: Pubkey }

#[event]
pub struct BattleStarted { pub battle_id: u64 }

#[event]
pub struct BetPlaced { pub bettor: Pubkey, pub battle_id: u64, pub side: u8, pub amount: u64 }

#[event]
pub struct DamageReported { pub battle_id: u64, pub target: u8, pub damage: u8, pub hp_a: u8, pub hp_b: u8 }

#[event]
pub struct BattleResolved { pub battle_id: u64, pub winner_side: u8, pub hp_a: u8, pub hp_b: u8 }

#[event]
pub struct WinningsClaimed { pub bettor: Pubkey, pub battle_id: u64, pub payout: u64 }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum PoBError {
    #[msg("Robot name must be 32 characters or less")]
    NameTooLong,
    #[msg("Stats must be between 0 and 100")]
    InvalidStats,
    #[msg("Battle is not open for bets")]
    BattleNotOpen,
    #[msg("Battle is not active")]
    BattleNotActive,
    #[msg("Battle is not finished yet")]
    BattleNotFinished,
    #[msg("Invalid side: must be 0 or 1")]
    InvalidSide,
    #[msg("Bet amount must be greater than 0")]
    InvalidBetAmount,
    #[msg("Damage must be between 0 and 50")]
    InvalidDamage,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Wrong battle ID")]
    WrongBattle,
    #[msg("You did not win this battle")]
    DidNotWin,
    #[msg("No winner declared yet")]
    NoWinner,
    #[msg("Solo el dueño del robot A puede crear la batalla")]
    NotRobotOwner,
}
