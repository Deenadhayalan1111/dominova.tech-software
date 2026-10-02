const express = require('express');
const supabase = require('../db/supabase');

const {
  authenticate,
  requireRole
} = require('../middleware/auth');

const {
  createNotification,
  createAuditLog,
  generateWithdrawalId,
  generateTransactionId
} = require('../middleware/helpers');

const router = express.Router();


// ============================================================
// GET /api/wallets/me
// ============================================================

router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: wallet, error: walletError } =
      await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', req.user.id)
        .maybeSingle();

    if (walletError) throw walletError;

    if (!wallet) {
      return res.status(404).json({
        error: 'Wallet not found'
      });
    }

    const { data: transactions, error: transactionError } =
      await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(100);

    if (transactionError) throw transactionError;

    const enrichedTransactions =
      await Promise.all(
        (transactions || []).map(async transaction => {
          if (!transaction.project_id) {
            return {
              ...transaction,
              project_id_display: null,
              project_client: null
            };
          }

          const { data: project } =
            await supabase
              .from('projects')
              .select('project_id, client_name')
              .eq('id', transaction.project_id)
              .maybeSingle();

          return {
            ...transaction,
            project_id_display:
              project?.project_id || null,
            project_client:
              project?.client_name || null
          };
        })
      );

    res.json({
      wallet,
      transactions: enrichedTransactions
    });

  } catch (err) {
    console.error('GET MY WALLET ERROR:', err);

    res.status(500).json({
      error: 'Failed to fetch wallet'
    });
  }
});


// ============================================================
// GET /api/wallets/:userId
// Admin views any user's wallet
// ============================================================

router.get(
  '/:userId',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: wallet, error: walletError } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', req.params.userId)
          .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      const { data: user, error: userError } =
        await supabase
          .from('users')
          .select('name, email, role')
          .eq('id', req.params.userId)
          .maybeSingle();

      if (userError) throw userError;

      const enrichedWallet = {
        ...wallet,
        user_name: user?.name || null,
        user_email: user?.email || null,
        user_role: user?.role || null
      };

      const { data: transactions, error: transactionError } =
        await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', req.params.userId)
          .order('created_at', { ascending: false })
          .limit(200);

      if (transactionError) throw transactionError;

      const enrichedTransactions =
        await Promise.all(
          (transactions || []).map(async transaction => {
            if (!transaction.project_id) {
              return {
                ...transaction,
                project_id_display: null,
                project_client: null
              };
            }

            const { data: project } =
              await supabase
                .from('projects')
                .select('project_id, client_name')
                .eq('id', transaction.project_id)
                .maybeSingle();

            return {
              ...transaction,
              project_id_display:
                project?.project_id || null,
              project_client:
                project?.client_name || null
            };
          })
        );

      res.json({
        wallet: enrichedWallet,
        transactions: enrichedTransactions
      });

    } catch (err) {
      console.error('GET USER WALLET ERROR:', err);

      res.status(500).json({
        error: 'Failed to fetch wallet'
      });
    }
  }
);


// ============================================================
// GET /api/wallets
// Admin sees all wallets
// ============================================================

router.get(
  '/',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: users, error: usersError } =
        await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('is_active', 1)
          .neq('role', 'admin')
          .order('role')
          .order('name');

      if (usersError) throw usersError;

      const wallets = [];

      for (const user of users || []) {
        const { data: wallet, error } =
          await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) throw error;

        if (wallet) {
          wallets.push({
            ...wallet,
            user_name: user.name,
            user_email: user.email,
            user_role: user.role
          });
        }
      }

      res.json({ wallets });

    } catch (err) {
      console.error('GET ALL WALLETS ERROR:', err);

      res.status(500).json({
        error: 'Failed to fetch wallets'
      });
    }
  }
);


// ============================================================
// POST /api/wallets/credit
// Admin manually credits wallet
// ============================================================

router.post(
  '/credit',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        user_id,
        amount,
        description,
        note,
        project_id,
        type
      } = req.body;

      if (!user_id || !amount || !description) {
        return res.status(400).json({
          error:
            'user_id, amount, and description are required'
        });
      }

      const creditAmount =
        parseFloat(amount);

      if (
        Number.isNaN(creditAmount) ||
        creditAmount <= 0
      ) {
        return res.status(400).json({
          error: 'Valid amount required'
        });
      }

      const { data: wallet, error: walletError } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user_id)
          .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      const txnId =
        await generateTransactionId();

      const { error: transactionError } =
        await supabase
          .from('wallet_transactions')
          .insert({
            transaction_id: txnId,
            wallet_id: wallet.id,
            user_id,
            project_id: project_id || null,
            type:
              type || 'ADJUSTMENT_CREDIT',
            amount: creditAmount,
            direction: 'CREDIT',
            description,
            note: note || null,
            status: 'COMPLETED',
            created_by: req.user.id
          });

      if (transactionError) {
        throw transactionError;
      }

      const { error: updateError } =
        await supabase
          .from('wallets')
          .update({
            total_earned:
              Number(wallet.total_earned || 0) +
              creditAmount,

            available_balance:
              Number(wallet.available_balance || 0) +
              creditAmount,

            updated_at:
              new Date().toISOString()
          })
          .eq('user_id', user_id);

      if (updateError) throw updateError;

      await createAuditLog({
        userId: req.user.id,
        action: 'MANUAL_CREDIT',
        entityType: 'wallet',
        entityId: wallet.id,
        description:
          `Admin credited ₹${creditAmount} to user ${user_id}: ${description}`
      });

      await createNotification({
        userId: user_id,
        title: 'Wallet Credited',
        message:
          `₹${creditAmount} has been credited to your wallet. ${description}`,
        type: 'SUCCESS',
        entityType: 'wallet',
        entityId: wallet.id,
        link: '/wallet'
      });

      res.json({
        message: 'Wallet credited',
        transactionId: txnId
      });

    } catch (err) {
      console.error('WALLET CREDIT ERROR:', err);

      res.status(500).json({
        error: 'Failed to credit wallet'
      });
    }
  }
);


// ============================================================
// POST /api/wallets/withdraw
// Employee requests withdrawal
// ============================================================

router.post(
  '/withdraw',
  authenticate,
  async (req, res) => {
    try {
      if (req.user.role === 'admin') {
        return res.status(400).json({
          error:
            'Admin cannot request withdrawals'
        });
      }

      const {
        amount,
        notes
      } = req.body;

      const requestAmount =
        parseFloat(amount);

      if (
        Number.isNaN(requestAmount) ||
        requestAmount <= 0
      ) {
        return res.status(400).json({
          error: 'Valid amount required'
        });
      }

      const { data: wallet, error: walletError } =
        await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', req.user.id)
          .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      if (
        requestAmount >
        Number(wallet.available_balance || 0)
      ) {
        return res.status(400).json({
          error:
            `Insufficient balance. Available: ₹${wallet.available_balance}`
        });
      }

      const {
        data: pendingWithdrawal,
        error: pendingError
      } = await supabase
        .from('withdrawals')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (pendingError) throw pendingError;

      if (pendingWithdrawal) {
        return res.status(400).json({
          error:
            'You already have a pending withdrawal request'
        });
      }

      const withdrawalId =
        await generateWithdrawalId();

      const {
        data: withdrawal,
        error: withdrawalError
      } = await supabase
        .from('withdrawals')
        .insert({
          withdrawal_id: withdrawalId,
          user_id: req.user.id,
          wallet_id: wallet.id,
          amount: requestAmount,
          request_notes:
            notes || null,
          status: 'PENDING'
        })
        .select()
        .single();

      if (withdrawalError) {
        throw withdrawalError;
      }

      const { error: updateError } =
        await supabase
          .from('wallets')
          .update({
            available_balance:
              Number(wallet.available_balance || 0) -
              requestAmount,

            pending_withdrawal:
              Number(wallet.pending_withdrawal || 0) +
              requestAmount,

            updated_at:
              new Date().toISOString()
          })
          .eq('user_id', req.user.id);

      if (updateError) throw updateError;

      const {
        data: admins,
        error: adminsError
      } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', 1);

      if (adminsError) throw adminsError;

      for (const admin of admins || []) {
        await createNotification({
          userId: admin.id,
          title: 'Withdrawal Request',
          message:
            `${req.user.name} has requested a withdrawal of ₹${requestAmount}.`,
          type: 'ACTION_REQUIRED',
          entityType: 'withdrawal',
          entityId: withdrawal.id,
          link: '/admin/withdrawals'
        });
      }

      res.status(201).json({
        message:
          'Withdrawal request submitted',
        withdrawalId
      });

    } catch (err) {
      console.error(
        'WITHDRAWAL REQUEST ERROR:',
        err
      );

      res.status(500).json({
        error:
          'Failed to submit withdrawal request'
      });
    }
  }
);


// ============================================================
// GET /api/wallets/withdrawals/my
// ============================================================

router.get(
  '/withdrawals/my',
  authenticate,
  async (req, res) => {
    try {
      const {
        data: withdrawals,
        error
      } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', {
          ascending: false
        });

      if (error) throw error;

      const enriched =
        await Promise.all(
          (withdrawals || []).map(
            async withdrawal => {
              let reviewedByName = null;

              if (withdrawal.reviewed_by) {
                const { data: reviewer } =
                  await supabase
                    .from('users')
                    .select('name')
                    .eq(
                      'id',
                      withdrawal.reviewed_by
                    )
                    .maybeSingle();

                reviewedByName =
                  reviewer?.name || null;
              }

              return {
                ...withdrawal,
                reviewed_by_name:
                  reviewedByName
              };
            }
          )
        );

      res.json({
        withdrawals: enriched
      });

    } catch (err) {
      console.error(
        'GET MY WITHDRAWALS ERROR:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch withdrawals'
      });
    }
  }
);


// ============================================================
// GET /api/wallets/withdrawals/all
// ============================================================

router.get(
  '/withdrawals/all',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { status } = req.query;

      let query = supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', {
          ascending: false
        });

      if (status) {
        query =
          query.eq('status', status);
      }

      const {
        data: withdrawals,
        error
      } = await query;

      if (error) throw error;

      const enriched =
        await Promise.all(
          (withdrawals || []).map(
            async withdrawal => {
              let user = null;
              let reviewer = null;

              if (withdrawal.user_id) {
                const { data } =
                  await supabase
                    .from('users')
                    .select('name, role')
                    .eq(
                      'id',
                      withdrawal.user_id
                    )
                    .maybeSingle();

                user = data;
              }

              if (
                withdrawal.reviewed_by
              ) {
                const { data } =
                  await supabase
                    .from('users')
                    .select('name')
                    .eq(
                      'id',
                      withdrawal.reviewed_by
                    )
                    .maybeSingle();

                reviewer = data;
              }

              return {
                ...withdrawal,

                user_name:
                  user?.name || null,

                user_role:
                  user?.role || null,

                reviewed_by_name:
                  reviewer?.name || null
              };
            }
          )
        );

      res.json({
        withdrawals: enriched
      });

    } catch (err) {
      console.error(
        'GET ALL WITHDRAWALS ERROR:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch withdrawals'
      });
    }
  }
);


// ============================================================
// POST /api/wallets/withdrawals/:id/approve
// ============================================================

router.post(
  '/withdrawals/:id/approve',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        data: withdrawal,
        error: withdrawalError
      } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', req.params.id)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (withdrawalError) {
        throw withdrawalError;
      }

      if (!withdrawal) {
        return res.status(400).json({
          error:
            'Withdrawal not found or not pending'
        });
      }

      const {
        admin_notes
      } = req.body;

      const {
        data: wallet,
        error: walletError
      } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', withdrawal.wallet_id)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      const txnId =
        await generateTransactionId();

      const { error: transactionError } =
        await supabase
          .from('wallet_transactions')
          .insert({
            transaction_id: txnId,
            wallet_id: withdrawal.wallet_id,
            user_id: withdrawal.user_id,
            type: 'WITHDRAWAL_DEBIT',
            amount: withdrawal.amount,
            direction: 'DEBIT',
            description:
              `Withdrawal approved - ${withdrawal.withdrawal_id}`,
            status: 'COMPLETED',
            created_by: req.user.id
          });

      if (transactionError) {
        throw transactionError;
      }

      const { error: walletUpdateError } =
        await supabase
          .from('wallets')
          .update({
            total_withdrawn:
              Number(wallet.total_withdrawn || 0) +
              Number(withdrawal.amount),

            pending_withdrawal:
              Number(wallet.pending_withdrawal || 0) -
              Number(withdrawal.amount),

            updated_at:
              new Date().toISOString()
          })
          .eq('id', withdrawal.wallet_id);

      if (walletUpdateError) {
        throw walletUpdateError;
      }

      const { error: withdrawalUpdateError } =
        await supabase
          .from('withdrawals')
          .update({
            status: 'APPROVED',
            admin_notes:
              admin_notes || null,
            reviewed_by:
              req.user.id,
            reviewed_at:
              new Date().toISOString(),
            updated_at:
              new Date().toISOString()
          })
          .eq('id', withdrawal.id);

      if (withdrawalUpdateError) {
        throw withdrawalUpdateError;
      }

      await createNotification({
        userId:
          withdrawal.user_id,

        title:
          'Withdrawal Approved!',

        message:
          `Your withdrawal of ₹${withdrawal.amount} has been approved.`,

        type:
          'SUCCESS',

        entityType:
          'withdrawal',

        entityId:
          withdrawal.id,

        link:
          '/wallet'
      });

      res.json({
        message:
          `Withdrawal of ₹${withdrawal.amount} approved`
      });

    } catch (err) {
      console.error(
        'APPROVE WITHDRAWAL ERROR:',
        err
      );

      res.status(500).json({
        error:
          'Failed to approve withdrawal'
      });
    }
  }
);


// ============================================================
// POST /api/wallets/withdrawals/:id/reject
// ============================================================

router.post(
  '/withdrawals/:id/reject',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        data: withdrawal,
        error: withdrawalError
      } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', req.params.id)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (withdrawalError) {
        throw withdrawalError;
      }

      if (!withdrawal) {
        return res.status(400).json({
          error:
            'Withdrawal not found or not pending'
        });
      }

      const {
        admin_notes
      } = req.body;

      if (
        !admin_notes ||
        !admin_notes.trim()
      ) {
        return res.status(400).json({
          error:
            'Admin notes/reason required for rejection'
        });
      }

      const {
        data: wallet,
        error: walletError
      } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', withdrawal.wallet_id)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      const { error: walletUpdateError } =
        await supabase
          .from('wallets')
          .update({
            available_balance:
              Number(wallet.available_balance || 0) +
              Number(withdrawal.amount),

            pending_withdrawal:
              Number(wallet.pending_withdrawal || 0) -
              Number(withdrawal.amount),

            updated_at:
              new Date().toISOString()
          })
          .eq('id', withdrawal.wallet_id);

      if (walletUpdateError) {
        throw walletUpdateError;
      }

      const { error: withdrawalUpdateError } =
        await supabase
          .from('withdrawals')
          .update({
            status: 'REJECTED',

            admin_notes:
              admin_notes.trim(),

            reviewed_by:
              req.user.id,

            reviewed_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()
          })
          .eq('id', withdrawal.id);

      if (withdrawalUpdateError) {
        throw withdrawalUpdateError;
      }

      await createNotification({
        userId:
          withdrawal.user_id,

        title:
          'Withdrawal Rejected',

        message:
          `Your withdrawal of ₹${withdrawal.amount} was rejected. Reason: ${admin_notes}`,

        type:
          'WARNING',

        entityType:
          'withdrawal',

        entityId:
          withdrawal.id,

        link:
          '/wallet'
      });

      res.json({
        message:
          'Withdrawal rejected, amount returned to balance'
      });

    } catch (err) {
      console.error(
        'REJECT WITHDRAWAL ERROR:',
        err
      );

      res.status(500).json({
        error:
          'Failed to reject withdrawal'
      });
    }
  }
);


module.exports = router;