import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { signOut } from '../lib/auth'
import { getAllRecipes, getRecipesByIngredients, getAllIngredients, getUserIngredients, addUserIngredient, removeUserIngredient } from '../lib/api'
import type { Recipe } from '../types'

export default function RecipesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([])
  const [allIngredients, setAllIngredients] = useState<string[]>([])
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [showIngredientSearch, setShowIngredientSearch] = useState(false)
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState('')

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    if (user && selectedIngredients.size > 0) {
      filterRecipes()
    } else {
      setFilteredRecipes(recipes)
    }
  }, [selectedIngredients, recipes, user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [recipesData, ingredientsData, userIngredientsData] = await Promise.all([
        getAllRecipes(),
        getAllIngredients(),
        getUserIngredients(user.id),
      ])
      setRecipes(recipesData)
      setFilteredRecipes(recipesData)
      setAllIngredients(ingredientsData)
      // Pre-select user's ingredients
      const userIngredientNames = new Set(userIngredientsData.map(ui => ui.ingredient_name))
      setSelectedIngredients(userIngredientNames)
    } catch (error) {
      console.error('Error loading recipes data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterRecipes = async () => {
    if (!user) return
    const ingredientArray = Array.from(selectedIngredients)
    const filtered = await getRecipesByIngredients(ingredientArray)
    setFilteredRecipes(filtered)
  }

  const handleIngredientToggle = async (ingredientName: string) => {
    if (!user) return

    const newSelected = new Set(selectedIngredients)
    if (newSelected.has(ingredientName)) {
      newSelected.delete(ingredientName)
      await removeUserIngredient(user.id, ingredientName)
    } else {
      newSelected.add(ingredientName)
      await addUserIngredient(user.id, ingredientName)
    }
    setSelectedIngredients(newSelected)
    // Don't call loadData() - just update the selection and let useEffect handle filtering
  }

  const handleAddCustomIngredient = async () => {
    if (!user || !ingredientSearchTerm.trim()) return

    const trimmed = ingredientSearchTerm.trim()
    await addUserIngredient(user.id, trimmed)
    const newSelected = new Set(selectedIngredients)
    newSelected.add(trimmed)
    setSelectedIngredients(newSelected)
    setIngredientSearchTerm('')
    setShowIngredientSearch(false)
    // Don't call loadData() - just update the selection
  }

  const filteredIngredients = allIngredients.filter(ing =>
    ing.toLowerCase().includes(ingredientSearchTerm.toLowerCase())
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}` : '/app/topics')}
                className="text-slate-300 hover:text-white mr-4 transition-colors"
              >
                ← {partnerId ? 'Partner Dashboard' : 'Dashboard'}
              </button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Recipes</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-slate-300 hover:text-white p-2 rounded-lg text-xl transition-all hover:bg-slate-700/50 active:scale-95"
                aria-label="Settings"
              >
                ⚙️
              </button>
              <button
                onClick={handleSignOut}
                className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-slate-700/50 active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Ingredients Selection */}
        <div className="glass backdrop-blur-sm rounded-2xl shadow-lg border border-slate-600/50 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-bold text-white">What ingredients do you have?</h2>
            <button
              onClick={() => setShowIngredientSearch(!showIngredientSearch)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              {showIngredientSearch ? 'Hide Search' : '+ Add Ingredient'}
            </button>
          </div>

          {showIngredientSearch && (
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ingredientSearchTerm}
                  onChange={(e) => setIngredientSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomIngredient()
                    }
                  }}
                  placeholder="Search or add ingredient..."
                  className="flex-1 px-4 py-2 border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  onClick={handleAddCustomIngredient}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Add
                </button>
              </div>
              {ingredientSearchTerm && filteredIngredients.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto glass backdrop-blur-sm rounded-lg border border-slate-600/50">
                  {filteredIngredients.slice(0, 10).map((ingredient) => (
                    <button
                      key={ingredient}
                      onClick={() => {
                        setIngredientSearchTerm(ingredient)
                        handleIngredientToggle(ingredient)
                        setShowIngredientSearch(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700/50 text-white text-sm transition-colors rounded-lg"
                    >
                      {ingredient}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Ingredients */}
          {selectedIngredients.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedIngredients).map((ingredient) => (
                <button
                  key={ingredient}
                  onClick={() => handleIngredientToggle(ingredient)}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm hover:bg-indigo-500 flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  {ingredient}
                  <span className="text-xs">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipes List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-slate-400">Loading recipes...</div>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="glass backdrop-blur-sm rounded-2xl shadow-lg border border-slate-600/50 p-8 text-center">
            <div className="text-6xl mb-4">🍳</div>
            <h3 className="text-xl font-semibold text-white mb-2">No recipes found</h3>
            <p className="text-slate-400">
              {selectedIngredients.size === 0
                ? 'Select some ingredients to see recipes you can make!'
                : 'No recipes match your selected ingredients. Try adding more ingredients!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe)}
                className="glass backdrop-blur-sm rounded-2xl shadow-lg border border-slate-600/50 p-6 hover:border-indigo-500 cursor-pointer transition-all card-hover"
              >
                <h3 className="text-xl font-bold text-white mb-2">{recipe.title}</h3>
                {recipe.description && (
                  <p className="text-slate-400 text-sm mb-3 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {recipe.prep_time && (
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-lg">
                      ⏱️ {recipe.prep_time} min prep
                    </span>
                  )}
                  {recipe.cook_time && (
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-lg">
                      🔥 {recipe.cook_time} min cook
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-lg">
                      👥 {recipe.servings} servings
                    </span>
                  )}
                </div>
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="text-xs text-slate-500">
                    {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recipe Detail Modal */}
        {selectedRecipe && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="glass backdrop-blur-xl rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto border-t sm:border border-slate-600/50">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-white">{selectedRecipe.title}</h2>
                  <button
                    onClick={() => setSelectedRecipe(null)}
                    className="text-slate-400 hover:text-white text-2xl sm:text-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {selectedRecipe.description && (
                  <p className="text-slate-300 mb-4">{selectedRecipe.description}</p>
                )}

                <div className="flex flex-wrap gap-3 mb-6">
                  {selectedRecipe.prep_time && (
                    <div className="text-sm text-slate-400">
                      <span className="font-semibold">Prep:</span> {selectedRecipe.prep_time} min
                    </div>
                  )}
                  {selectedRecipe.cook_time && (
                    <div className="text-sm text-slate-400">
                      <span className="font-semibold">Cook:</span> {selectedRecipe.cook_time} min
                    </div>
                  )}
                  {selectedRecipe.servings && (
                    <div className="text-sm text-slate-400">
                      <span className="font-semibold">Serves:</span> {selectedRecipe.servings}
                    </div>
                  )}
                </div>

                {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Ingredients</h3>
                    <ul className="space-y-2">
                      {selectedRecipe.ingredients.map((ingredient) => (
                        <li key={ingredient.id} className="flex items-start gap-2">
                          <span className="text-indigo-400 mt-1">•</span>
                          <span className="text-slate-300">
                            {ingredient.amount && <span className="font-medium">{ingredient.amount} </span>}
                            {ingredient.ingredient_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRecipe.instructions && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Instructions</h3>
                    <div className="text-slate-300 whitespace-pre-line">{selectedRecipe.instructions}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

