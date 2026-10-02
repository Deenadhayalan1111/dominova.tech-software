const supabase = require('../db/supabase');


// ============================================================
// CREATE NOTIFICATION
// ============================================================
async function createNotification({
  userId,
  title,
  message,
  type = 'INFO',
  entityType = null,
  entityId = null,
  link = null
}) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      entity_type: entityType,
      entity_id: entityId,
      link
    })
    .select()
    .single();

  if (error) {
    console.error('createNotification error:', error);
    throw error;
  }

  return data;
}


// ============================================================
// CREATE AUDIT LOG
// ============================================================
async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  description,
  oldValue = null,
  newValue = null
}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      old_value:
        oldValue !== null
          ? JSON.stringify(oldValue)
          : null,
      new_value:
        newValue !== null
          ? JSON.stringify(newValue)
          : null
    })
    .select()
    .single();

  if (error) {
    console.error('createAuditLog error:', error);
    throw error;
  }

  return data;
}


// ============================================================
// CREATE LEAD ACTIVITY
// ============================================================
async function createLeadActivity({
  leadId,
  userId,
  activityType,
  description,
  metadata = null
}) {
  const { data, error } = await supabase
    .from('lead_activities')
    .insert({
      lead_id: leadId,
      user_id: userId,
      activity_type: activityType,
      description,
      metadata:
        metadata !== null
          ? JSON.stringify(metadata)
          : null
    })
    .select()
    .single();

  if (error) {
    console.error('createLeadActivity error:', error);
    throw error;
  }

  return data;
}


// ============================================================
// RECORD PROJECT STATUS CHANGE
// ============================================================
async function recordProjectStatusChange({
  projectId,
  oldStatus,
  newStatus,
  changedBy,
  notes = null
}) {
  const { data, error } = await supabase
    .from('project_status_history')
    .insert({
      project_id: projectId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      notes
    })
    .select()
    .single();

  if (error) {
    console.error('recordProjectStatusChange error:', error);
    throw error;
  }

  return data;
}


// ============================================================
// GENERATE TRANSACTION ID
// ============================================================
async function generateTransactionId() {
  const { count, error } = await supabase
    .from('wallet_transactions')
    .select('*', {
      count: 'exact',
      head: true
    });

  if (error) {
    console.error('generateTransactionId error:', error);
    throw error;
  }

  return `TXN-${String((count || 0) + 1).padStart(6, '0')}`;
}


// ============================================================
// GENERATE WITHDRAWAL ID
// ============================================================
async function generateWithdrawalId() {
  const { count, error } = await supabase
    .from('withdrawals')
    .select('*', {
      count: 'exact',
      head: true
    });

  if (error) {
    console.error('generateWithdrawalId error:', error);
    throw error;
  }

  return `WD-${String((count || 0) + 1).padStart(4, '0')}`;
}


// ============================================================
// CREDIT WALLET
// ============================================================
async function creditWallet({
  userId,
  projectId,
  amount,
  type,
  description,
  note,
  createdBy
}) {
  // Find wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletError) {
    console.error('Wallet lookup error:', walletError);
    throw walletError;
  }

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Generate transaction ID
  const txnId = await generateTransactionId();

  // Create transaction
  const { data: transaction, error: transactionError } =
    await supabase
      .from('wallet_transactions')
      .insert({
        transaction_id: txnId,
        wallet_id: wallet.id,
        user_id: userId,
        project_id: projectId,
        type,
        amount,
        direction: 'CREDIT',
        description,
        note: note || null,
        status: 'COMPLETED',
        created_by: createdBy
      })
      .select()
      .single();

  if (transactionError) {
    console.error('Wallet transaction error:', transactionError);
    throw transactionError;
  }

  // Update wallet
  const { error: updateError } = await supabase
    .from('wallets')
    .update({
      total_earned:
        Number(wallet.total_earned || 0) + Number(amount),

      available_balance:
        Number(wallet.available_balance || 0) + Number(amount),

      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Wallet update error:', updateError);
    throw updateError;
  }

  return txnId;
}


module.exports = {
  createNotification,
  createAuditLog,
  createLeadActivity,
  recordProjectStatusChange,
  generateTransactionId,
  generateWithdrawalId,
  creditWallet
};