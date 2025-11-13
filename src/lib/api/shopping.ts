import { supabase } from '../supabaseClient'
import type { ShoppingItem } from '../../types'
import { getGroupIdsForUser } from './utils'

export async function getShoppingItems(
  userId: string,
  filterPartnerId?: string | null,
  filterGroupId?: string | null
): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching shopping list items:', error)
    return []
  }

  const groupIds = await getGroupIdsForUser(userId)
  const groupSet = new Set(groupIds)

  let items = (data as ShoppingItem[]) || []

  items = items.filter((item) => {
    if (item.group_id) {
      return groupSet.has(item.group_id)
    }
    return item.user_id === userId || item.partner_id === userId
  })

  if (filterGroupId) {
    items = items.filter((item) => item.group_id === filterGroupId)
  }

  if (filterPartnerId) {
    items = items.filter(
      (item) =>
        !item.group_id &&
        (item.partner_id === filterPartnerId ||
          (item.user_id === filterPartnerId && item.partner_id === userId))
    )
  }

  return items
}

export async function createShoppingItem(
  userId: string,
  itemName: string,
  quantity?: string | null,
  partnerId?: string | null,
  notes?: string | null,
  groupId?: string | null
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  if (partnerId && groupId) {
    console.warn('Cannot create shopping item with both partner and group. Using partner.')
    groupId = null
  }

  const payload = {
    user_id: userId,
    item_name: itemName,
    quantity: quantity ?? null,
    partner_id: partnerId ?? null,
    notes: notes ?? null,
    group_id: groupId ?? null,
  }

  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Error creating shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function updateShoppingItem(
  itemId: string,
  updates: {
    item_name?: string
    quantity?: string | null
    notes?: string | null
    partner_id?: string | null
  }
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Error updating shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function toggleShoppingItemPurchased(
  itemId: string,
  purchased: boolean
): Promise<{ item: ShoppingItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({
      purchased,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    console.error('Error toggling shopping list item:', error)
    return { item: null, error: error.message }
  }

  return { item: data as ShoppingItem, error: null }
}

export async function deleteShoppingItem(itemId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    console.error('Error deleting shopping list item:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

