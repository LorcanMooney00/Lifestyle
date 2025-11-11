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
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

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
      setShowAddModal(false)
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
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-3">
            <button
              onClick={() => navigate('/app/topics')}
              className="text-slate-300 hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
            >
              ← Dashboard
            </button>
            
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-thin px-2">
              <button
                onClick={() => navigate('/app/calendar')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                📅 Calendar
              </button>
              <button
                onClick={() => navigate('/app/notes')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                📝 Notes
              </button>
              <button
                onClick={() => navigate('/app/todos')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                ✓ To-Do
              </button>
              <button
                onClick={() => navigate('/app/shopping')}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm font-medium whitespace-nowrap flex-shrink-0"
              >
                🛒 Shopping
              </button>
            </div>

            <div className="flex items-center flex-shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="text-slate-300 hover:text-white p-2 rounded-lg transition-all hover:bg-slate-700/50 disabled:opacity-50"
                title="Refresh"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 active:scale-95"
            >
              + Add Item
            </button>
            {!partnerId && (
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                  aria-label="Filter items"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
                
                {showFilterDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-20">
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setFilterPartnerId('all')
                            setShowFilterDropdown(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            filterPartnerId === 'all'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          All items
                        </button>
                        <button
                          onClick={() => {
                            setFilterPartnerId('personal')
                            setShowFilterDropdown(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            filterPartnerId === 'personal'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          Just me
                        </button>
                        {partners.map((partner) => (
                          <button
                            key={partner.id}
                            onClick={() => {
                              setFilterPartnerId(partner.id)
                              setShowFilterDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              filterPartnerId === partner.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {partner.username || partner.email}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setShowPurchased(!showPurchased)}
              className={`p-2 rounded-lg transition-colors ${
                showPurchased
                  ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              aria-label="Toggle purchased items"
              title={showPurchased ? 'Hide purchased items' : 'Show purchased items'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

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
                <div className="space-y-2">
                  {activeItems.map((item) => {
                    const isProcessing = actionIds.includes(item.id)
                    const assignedLabel = getPartnerLabel(item)

                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 transition hover:border-indigo-400/40"
                      >
                        <button
                          onClick={() => handleTogglePurchased(item.id, true)}
                          disabled={isProcessing}
                          className="w-5 h-5 rounded border-2 border-slate-500 hover:border-emerald-400 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                          {isProcessing && (
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-medium text-white">{item.item_name}</p>
                            {item.quantity && (
                              <span className="text-xs text-indigo-300">({item.quantity})</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">Shared with {assignedLabel}</p>
                        </div>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={isProcessing}
                          className="opacity-30 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          aria-label="Delete item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
                  <div className="space-y-2">
                    {purchasedItems.map((item) => {
                      const isProcessing = actionIds.includes(item.id)
                      const assignedLabel = getPartnerLabel(item)

                      return (
                        <div
                          key={item.id}
                          className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 opacity-60"
                        >
                          <button
                            onClick={() => handleTogglePurchased(item.id, false)}
                            disabled={isProcessing}
                            className="w-5 h-5 rounded border-2 border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <p className="text-sm font-medium text-slate-400 line-through">{item.item_name}</p>
                              {item.quantity && (
                                <span className="text-xs text-slate-500 line-through">({item.quantity})</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600">Shared with {assignedLabel}</p>
                          </div>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isProcessing}
                            className="opacity-20 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                            aria-label="Delete item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Add Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Add Shopping Item</h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setError(null)
                    }}
                    className="text-slate-400 hover:text-white text-2xl transition-colors"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreateItem} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="E.g. Almond milk"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                      disabled={creating}
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Quantity (optional)
                    </label>
                    <input
                      type="text"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      placeholder="E.g. 2 cartons"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                      disabled={creating}
                    />
                  </div>

                  {!partnerId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Share With
                      </label>
                      <select
                        value={newItemPartnerId}
                        onChange={(e) => setNewItemPartnerId(e.target.value)}
                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
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

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        setError(null)
                      }}
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-600/50 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                    >
                      {creating ? 'Adding…' : 'Add Item'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


