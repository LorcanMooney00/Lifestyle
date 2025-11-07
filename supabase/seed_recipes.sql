-- Seed Recipes Database
-- Run this AFTER creating the tables (schema.sql or reset.sql)
-- This populates the database with initial recipes

-- Insert Recipes
INSERT INTO public.recipes (title, description, instructions, prep_time, cook_time, servings) VALUES
('Spaghetti Carbonara', 'Classic Italian pasta dish with eggs, cheese, and bacon', '1. Cook spaghetti according to package directions. 2. In a pan, cook bacon until crispy. 3. Beat eggs with parmesan cheese. 4. Drain pasta and immediately toss with egg mixture and bacon. 5. Serve immediately.', 10, 15, 4),
('Chicken Stir Fry', 'Quick and healthy stir fry with vegetables', '1. Cut chicken into strips. 2. Heat oil in a wok or large pan. 3. Cook chicken until done. 4. Add vegetables and stir fry until tender. 5. Add sauce and serve over rice.', 15, 10, 4),
('Chocolate Chip Cookies', 'Classic homemade cookies', '1. Cream butter and sugars. 2. Add eggs and vanilla. 3. Mix in flour and baking soda. 4. Fold in chocolate chips. 5. Bake at 375°F for 10-12 minutes.', 15, 12, 24),
('Caesar Salad', 'Fresh romaine lettuce with caesar dressing', '1. Wash and chop romaine lettuce. 2. Make caesar dressing with anchovies, garlic, lemon, and parmesan. 3. Toss lettuce with dressing. 4. Add croutons and parmesan cheese.', 10, 0, 4),
('Beef Tacos', 'Ground beef tacos with your favorite toppings', '1. Brown ground beef with taco seasoning. 2. Warm taco shells. 3. Fill shells with beef. 4. Add lettuce, tomatoes, cheese, and salsa.', 10, 15, 6),
('Pancakes', 'Fluffy breakfast pancakes', '1. Mix flour, baking powder, salt, and sugar. 2. Add milk, eggs, and melted butter. 3. Cook on griddle until bubbles form. 4. Flip and cook until golden.', 10, 15, 8),
('Grilled Salmon', 'Simple grilled salmon with lemon', '1. Season salmon fillets with salt and pepper. 2. Grill for 4-5 minutes per side. 3. Squeeze lemon juice over top. 4. Serve with vegetables.', 5, 10, 4),
('Vegetable Soup', 'Hearty vegetable soup', '1. Sauté onions and garlic. 2. Add vegetables and broth. 3. Simmer until vegetables are tender. 4. Season with salt and pepper.', 15, 30, 6),
('Margherita Pizza', 'Classic Italian pizza', '1. Make or use pizza dough. 2. Top with tomato sauce, mozzarella, and fresh basil. 3. Bake at 450°F for 12-15 minutes.', 20, 15, 4),
('Chicken Curry', 'Spicy chicken curry', '1. Brown chicken pieces. 2. Add onions and curry spices. 3. Add coconut milk and simmer. 4. Serve with rice.', 15, 30, 4)
ON CONFLICT DO NOTHING;

-- Get recipe IDs (we'll need these for ingredients)
-- Note: In a real scenario, you'd want to use the actual IDs returned
-- For now, we'll insert ingredients using a subquery

-- Spaghetti Carbonara ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'spaghetti', '400g' FROM public.recipes WHERE title = 'Spaghetti Carbonara'
UNION ALL SELECT id, 'eggs', '3 large' FROM public.recipes WHERE title = 'Spaghetti Carbonara'
UNION ALL SELECT id, 'bacon', '200g' FROM public.recipes WHERE title = 'Spaghetti Carbonara'
UNION ALL SELECT id, 'parmesan cheese', '100g' FROM public.recipes WHERE title = 'Spaghetti Carbonara'
UNION ALL SELECT id, 'black pepper', 'to taste' FROM public.recipes WHERE title = 'Spaghetti Carbonara'
ON CONFLICT DO NOTHING;

-- Chicken Stir Fry ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'chicken breast', '500g' FROM public.recipes WHERE title = 'Chicken Stir Fry'
UNION ALL SELECT id, 'bell peppers', '2' FROM public.recipes WHERE title = 'Chicken Stir Fry'
UNION ALL SELECT id, 'onions', '1' FROM public.recipes WHERE title = 'Chicken Stir Fry'
UNION ALL SELECT id, 'soy sauce', '3 tbsp' FROM public.recipes WHERE title = 'Chicken Stir Fry'
UNION ALL SELECT id, 'garlic', '2 cloves' FROM public.recipes WHERE title = 'Chicken Stir Fry'
UNION ALL SELECT id, 'vegetable oil', '2 tbsp' FROM public.recipes WHERE title = 'Chicken Stir Fry'
ON CONFLICT DO NOTHING;

-- Chocolate Chip Cookies ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'flour', '2.5 cups' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'butter', '1 cup' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'sugar', '3/4 cup' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'brown sugar', '3/4 cup' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'eggs', '2' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'vanilla extract', '1 tsp' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'baking soda', '1 tsp' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
UNION ALL SELECT id, 'chocolate chips', '2 cups' FROM public.recipes WHERE title = 'Chocolate Chip Cookies'
ON CONFLICT DO NOTHING;

-- Caesar Salad ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'romaine lettuce', '1 head' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'parmesan cheese', '50g' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'croutons', '1 cup' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'anchovies', '2 fillets' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'garlic', '1 clove' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'lemon', '1' FROM public.recipes WHERE title = 'Caesar Salad'
UNION ALL SELECT id, 'olive oil', '3 tbsp' FROM public.recipes WHERE title = 'Caesar Salad'
ON CONFLICT DO NOTHING;

-- Beef Tacos ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'ground beef', '500g' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'taco shells', '12' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'lettuce', '2 cups shredded' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'tomatoes', '2 diced' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'cheese', '1 cup shredded' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'salsa', '1/2 cup' FROM public.recipes WHERE title = 'Beef Tacos'
UNION ALL SELECT id, 'taco seasoning', '1 packet' FROM public.recipes WHERE title = 'Beef Tacos'
ON CONFLICT DO NOTHING;

-- Pancakes ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'flour', '1.5 cups' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'milk', '1.25 cups' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'eggs', '1' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'butter', '3 tbsp melted' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'sugar', '2 tbsp' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'baking powder', '3 tsp' FROM public.recipes WHERE title = 'Pancakes'
UNION ALL SELECT id, 'salt', '1/2 tsp' FROM public.recipes WHERE title = 'Pancakes'
ON CONFLICT DO NOTHING;

-- Grilled Salmon ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'salmon fillets', '4' FROM public.recipes WHERE title = 'Grilled Salmon'
UNION ALL SELECT id, 'lemon', '1' FROM public.recipes WHERE title = 'Grilled Salmon'
UNION ALL SELECT id, 'olive oil', '2 tbsp' FROM public.recipes WHERE title = 'Grilled Salmon'
UNION ALL SELECT id, 'salt', 'to taste' FROM public.recipes WHERE title = 'Grilled Salmon'
UNION ALL SELECT id, 'black pepper', 'to taste' FROM public.recipes WHERE title = 'Grilled Salmon'
ON CONFLICT DO NOTHING;

-- Vegetable Soup ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'onions', '2' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'carrots', '3' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'celery', '2 stalks' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'garlic', '3 cloves' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'vegetable broth', '6 cups' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'tomatoes', '2' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'salt', 'to taste' FROM public.recipes WHERE title = 'Vegetable Soup'
UNION ALL SELECT id, 'black pepper', 'to taste' FROM public.recipes WHERE title = 'Vegetable Soup'
ON CONFLICT DO NOTHING;

-- Margherita Pizza ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'pizza dough', '1 ball' FROM public.recipes WHERE title = 'Margherita Pizza'
UNION ALL SELECT id, 'tomato sauce', '1/2 cup' FROM public.recipes WHERE title = 'Margherita Pizza'
UNION ALL SELECT id, 'mozzarella cheese', '200g' FROM public.recipes WHERE title = 'Margherita Pizza'
UNION ALL SELECT id, 'fresh basil', '10 leaves' FROM public.recipes WHERE title = 'Margherita Pizza'
UNION ALL SELECT id, 'olive oil', '2 tbsp' FROM public.recipes WHERE title = 'Margherita Pizza'
ON CONFLICT DO NOTHING;

-- Chicken Curry ingredients
INSERT INTO public.recipe_ingredients (recipe_id, ingredient_name, amount)
SELECT id, 'chicken', '500g' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'onions', '2' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'curry powder', '2 tbsp' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'coconut milk', '400ml' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'garlic', '3 cloves' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'ginger', '1 inch' FROM public.recipes WHERE title = 'Chicken Curry'
UNION ALL SELECT id, 'vegetable oil', '2 tbsp' FROM public.recipes WHERE title = 'Chicken Curry'
ON CONFLICT DO NOTHING;

