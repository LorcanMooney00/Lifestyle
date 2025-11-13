import { supabase } from '../supabaseClient'
import type { Recipe, RecipeIngredient, UserIngredient } from '../../types'

export async function getAllRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('title', { ascending: true })

  if (error) {
    console.error('Error fetching recipes:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Fetch ingredients for all recipes
  const recipeIds = data.map((r: any) => r.id)
  const { data: ingredientsData } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in('recipe_id', recipeIds)

  // Group ingredients by recipe_id
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>()
  if (ingredientsData) {
    ingredientsData.forEach((ing: any) => {
      if (!ingredientsByRecipe.has(ing.recipe_id)) {
        ingredientsByRecipe.set(ing.recipe_id, [])
      }
      ingredientsByRecipe.get(ing.recipe_id)!.push(ing)
    })
  }

  // Attach ingredients to recipes
  return data.map((recipe: any) => ({
    ...recipe,
    ingredients: ingredientsByRecipe.get(recipe.id) || [],
  }))
}

export async function getRecipesByIngredients(selectedIngredientNames: string[]): Promise<Recipe[]> {
  if (selectedIngredientNames.length === 0) {
    return getAllRecipes()
  }

  // Normalize selected ingredient names for comparison
  const selectedLower = selectedIngredientNames.map(name => name.toLowerCase().trim())

  // Get all recipes that use at least one of the selected ingredients
  const { data: matchingIngredients, error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, ingredient_name')
    .in('ingredient_name', selectedIngredientNames)

  if (ingredientsError) {
    console.error('Error fetching recipes by ingredients:', ingredientsError)
    return []
  }

  if (!matchingIngredients || matchingIngredients.length === 0) {
    return []
  }

  const recipeIds = [...new Set(matchingIngredients.map((ing: any) => ing.recipe_id))]

  // Get recipes
  const { data: recipesData, error: recipesError } = await supabase
    .from('recipes')
    .select('*')
    .in('id', recipeIds)
    .order('title', { ascending: true })

  if (recipesError) {
    console.error('Error fetching recipes:', recipesError)
    return []
  }

  if (!recipesData || recipesData.length === 0) return []

  // Fetch ingredients for all recipes
  const { data: ingredientsData } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in('recipe_id', recipeIds)

  // Group ingredients by recipe_id
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>()
  if (ingredientsData) {
    ingredientsData.forEach((ing: any) => {
      if (!ingredientsByRecipe.has(ing.recipe_id)) {
        ingredientsByRecipe.set(ing.recipe_id, [])
      }
      ingredientsByRecipe.get(ing.recipe_id)!.push(ing)
    })
  }

  // Attach ingredients to recipes and calculate match score
  const recipesWithScores = recipesData.map((recipe: any) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) || []
    const requiredIngredients = ingredients.map((ing: RecipeIngredient) => ing.ingredient_name.toLowerCase().trim())
    
    // Count how many ingredients match
    const matchingCount = requiredIngredients.filter((ing: string) => 
      selectedLower.includes(ing)
    ).length
    
    // Calculate match percentage
    const matchPercentage = ingredients.length > 0 ? (matchingCount / ingredients.length) * 100 : 0
    
    return {
      ...recipe,
      ingredients,
      matchingCount,
      matchPercentage,
    }
  })

  // Filter to show recipes that use at least one selected ingredient
  // Sort by match percentage (recipes with more matching ingredients first)
  return recipesWithScores
    .filter((recipe: any) => recipe.matchingCount > 0)
    .sort((a: any, b: any) => b.matchPercentage - a.matchPercentage)
    .map((recipe: any) => {
      // Remove the scoring fields before returning
      const { matchingCount, matchPercentage, ...recipeWithoutScores } = recipe
      return recipeWithoutScores
    })
}

export async function getAllIngredients(): Promise<string[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_name')
    .order('ingredient_name', { ascending: true })

  if (error) {
    console.error('Error fetching ingredients:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Get unique ingredient names
  const ingredientNames = data.map((ing: any) => String(ing.ingredient_name))
  const uniqueIngredients: string[] = Array.from(new Set(ingredientNames))
  return uniqueIngredients.sort()
}

export async function getUserIngredients(userId: string): Promise<UserIngredient[]> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .select('*')
    .eq('user_id', userId)
    .order('ingredient_name', { ascending: true })

  if (error) {
    console.error('Error fetching user ingredients:', error)
    return []
  }

  return data || []
}

export async function addUserIngredient(userId: string, ingredientName: string): Promise<UserIngredient | null> {
  const { data, error } = await supabase
    .from('user_ingredients')
    .insert({
      user_id: userId,
      ingredient_name: ingredientName,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding user ingredient:', error)
    return null
  }

  return data
}

export async function removeUserIngredient(userId: string, ingredientName: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_ingredients')
    .delete()
    .eq('user_id', userId)
    .eq('ingredient_name', ingredientName)

  if (error) {
    console.error('Error removing user ingredient:', error)
    return false
  }

  return true
}

