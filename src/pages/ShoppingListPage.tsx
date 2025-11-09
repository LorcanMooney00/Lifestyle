import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  createShoppingItem,
  deleteShoppingItem,
  getPartners,
  getShoppingItems,
  toggleShoppingItemPurchased,
} from '../lib/api'
import type { ShoppingItem } from '../types'

type PartnerInfo = {
  id: string
  email: string
  username: string
  profilePictureUrl?: string | null
}

export default function ShoppingListPage() {
  const { partnerId } = useParams<{ partnerId?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState<ShoppingItem[]>([])
  const [partners, setPartners] = useState<PartnerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [actionIds, setActionIds] = useState<string[]>([])

  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [newItemPartnerId, setNewItemPartnerId] = useState<string>(partnerId ?? '')
  const [filterPartnerId, setFilterPartnerId] = useState<string>(partnerId ?? 'all')
  const [showPurchased, setShowPurchased] = useState(false)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, partnerId])

  useEffect(() => {
    if (partnerId) {
      setNewItemPartnerId(partnerId)
      setFilterPartnerId(partnerId)
    }
  }, [partnerId])

  const partnerLookup = useMemo(() => {
    const map = new Map<string, PartnerInfo>()
    partners.forEach((partner) => {
      map.set(partner.id, partner)
    })
    return map
  }, [partners])

  const loadData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const [itemsData, partnersData] = await Promise.all([
        getShoppingItems(user.id),
        getPartners(user.id),
      ])

      setItems(itemsData)
      setPartners(partnersData)

      if (partnerId) {
        setNewItemPartnerId(partnerId)
        setFilterPartnerId(partnerId)
      }
    } catch (err) {
      console.error(err)
      setError('Could not load shopping list. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const trimmedName = newItemName.trim()
    if (!trimmedName) {
      setError('Item name cannot be empty.')
      return
    }

    setCreating(true)
    setError(null)

    const assignedPartnerId =
      partnerId ?? (newItemPartnerId && newItemPartnerId !== 'personal' ? newItemPartnerId : null)

    const quantityValue = newItemQuantity.trim() ? newItemQuantity.trim() : null

    const { item, error: createError } = await createShoppingItem(
      user.id,
      trimmedName,
      quantityValue,
      assignedPartnerId
    )

    if (createError || !item) {
      setError(createError || 'Failed to add item. Please try again.')
    } else {
      setItems((prev) => [...prev, item])
      setNewItemName('')
      setNewItemQuantity('')
      if (!partnerId) {
        setNewItemPartnerId('')
      }
    }

    setCreating(false)
  }

  const handleTogglePurchased = async (itemId: string, purchased: boolean) => {
    setActionIds((prev) => [...prev, itemId])
    setError(null)

    const { item, error: toggleError } = await toggleShoppingItemPurchased(itemId, purchased)

    if (toggleError || !item) {
      setError(toggleError || 'Failed to update item. Please try again.')
    } else {
      setItems((prev) => prev.map((listItem) => (listItem.id === item.id ? item : listItem)))
    }

    setActionIds((prev) => prev.filter((id) => id !== itemId))
  }

  const handleDeleteItem = async (itemId: string) => {
    setActionIds((prev) => [...prev, itemId])
    setError(null)

    const { success, error: deleteError } = await deleteShoppingItem(itemId)

    if (!success) {
      setError(deleteError || 'Failed to delete item. Please try again.')
    } else {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    }

    setActionIds((prev) => prev.filter((id) => id !== itemId))
  }

  const filteredItems = useMemo(() => {
    if (!partnerId && filterPartnerId === 'all') {
      return items
    }

    if (!partnerId && filterPartnerId === 'personal') {
      return items.filter((item) => item.partner_id === null)
    }

    const targetPartnerId = partnerId ?? (filterPartnerId === 'personal' ? null : filterPartnerId)

    if (!targetPartnerId) {
      return items.filter((item) => item.partner_id === null)
    }

    return items.filter(
      (item) => item.partner_id === targetPartnerId || item.user_id === targetPartnerId
    )
  }, [items, partnerId, filterPartnerId])

  const activeItems = filteredItems.filter((item) => !item.purchased)
  const purchasedItems = filteredItems.filter((item) => item.purchased)

  const getPartnerLabel = (item: ShoppingItem) => {
    if (item.partner_id) {
      const partner = partnerLookup.get(item.partner_id)
      if (partner) {
        return partner.username || partner.email
      }
    }

    const createdByPartner =
      item.user_id !== user?.id ? partnerLookup.get(item.user_id) : undefined

    if (createdByPartner) {
      return createdByPartner.username || createdByPartner.email
    }

    return 'Just you'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app/topics')}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              ← Dashboard
            </button>
            <h1 className="text-lg font-semibold text-white sm:text-xl">
              {partnerId ? 'Shared Shopping List' : 'Shopping List'}
            </h1>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Add an item</h2>
              <p className="text-sm text-slate-400">
                Keep track of groceries, supplies, and anything else you need.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={showPurchased}
                  onChange={(e) => setShowPurchased(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-400"
                />
                Show purchased items
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateItem} className="mt-6 grid gap-3 sm:grid-cols-[2fr,1fr,1fr,auto]">
            <div className="sm:col-span-1">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Item
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="E.g. Almond milk"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                disabled={creating}
                required
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Quantity (optional)
              </label>
              <input
                type="text"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
                placeholder="2 cartons"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                disabled={creating}
              />
            </div>

            {!partnerId && (
              <div className="sm:col-span-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Shared With
                </label>
                <select
                  value={newItemPartnerId}
                  onChange={(e) => setNewItemPartnerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  disabled={creating}
                >
                  <option value="">Just me</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.username || partner.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>

        {!partnerId && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white sm:text-base">Filter items</h3>
              <p className="text-xs text-slate-400">
                View personal items or focus on a specific partner’s list.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterPartnerId}
                onChange={(e) => setFilterPartnerId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="all">All items</option>
                <option value="personal">Just me</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.username || partner.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="rounded-full border-2 border-slate-700 border-b-transparent p-4 text-slate-300 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h3 className="mb-4 text-lg font-semibold text-white">Needs to be purchased</h3>

              {activeItems.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
                  {partnerId
                    ? 'No active items for this shopping list yet.'
                    : 'Nothing on your shopping list just yet. Add an item above to get started!'}
                </p>
              ) : (
                <div className="space-y-3">
                  {activeItems.map((item) => {
                    const isProcessing = actionIds.includes(item.id)
                    const assignedLabel = getPartnerLabel(item)
                    const addedBy =
                      item.user_id === user?.id
                        ? 'You'
                        : partnerLookup.get(item.user_id)?.username ||
                          partnerLookup.get(item.user_id)?.email ||
                          'Partner'

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 shadow-lg transition hover:border-indigo-400/40"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">🛒</span>
                              <div>
                                <p className="text-base font-semibold text-white">{item.item_name}</p>
                                {item.quantity && (
                                  <p className="text-xs uppercase tracking-wide text-indigo-300">
                                    {item.quantity}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5">
                                Shared with: {assignedLabel}
                              </span>
                              <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5">
                                Added by: {addedBy}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              onClick={() => handleTogglePurchased(item.id, true)}
                              disabled={isProcessing}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isProcessing ? 'Saving…' : 'Mark purchased'}
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={isProcessing}
                              className="rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isProcessing ? 'Removing…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {showPurchased && (
              <section>
                <h3 className="mb-4 text-lg font-semibold text-white">Purchased</h3>
                {purchasedItems.length === 0 ? (
                  <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
                    Mark items as purchased to keep a history here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {purchasedItems.map((item) => {
                      const isProcessing = actionIds.includes(item.id)
                      const assignedLabel = getPartnerLabel(item)
                      const addedBy =
                        item.user_id === user?.id
                          ? 'You'
                          : partnerLookup.get(item.user_id)?.username ||
                            partnerLookup.get(item.user_id)?.email ||
                            'Partner'

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4 shadow-inner"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="text-xl text-emerald-300">✔</span>
                                <div>
                                  <p className="text-base font-semibold text-slate-300 line-through">
                                    {item.item_name}
                                  </p>
                                  {item.quantity && (
                                    <p className="text-xs uppercase tracking-wide text-emerald-300/70 line-through">
                                      {item.quantity}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5">
                                  Shared with: {assignedLabel}
                                </span>
                                <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5">
                                  Added by: {addedBy}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                onClick={() => handleTogglePurchased(item.id, false)}
                                disabled={isProcessing}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-indigo-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isProcessing ? 'Saving…' : 'Move back to list'}
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={isProcessing}
                                className="rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isProcessing ? 'Removing…' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}


