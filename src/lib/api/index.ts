// Re-export all API functions for backward compatibility
// This allows existing imports like `import { getTopics } from '../lib/api'` to continue working

// Topics
export { getTopics, createTopic, addTopicMember } from './topics'

// Notes
export { getAllNotes, getNotes, createNote, updateNote, deleteNote } from './notes'

// User/Profile
export {
  getUserProfile,
  getTilePreferences,
  updateTilePreferences,
  updateUserProfile,
  uploadProfilePicture,
  getProfilePictureUrl,
} from './user'

// Partners
export { getPartners, linkPartner, unlinkPartner } from './partners'

// Events
export { getEvents, createEvent, updateEvent, deleteEvent } from './events'

// Todos
export {
  getTodos,
  createTodo,
  updateTodoContent,
  toggleTodoCompletion,
  deleteTodo,
} from './todos'

// Shopping
export {
  getShoppingItems,
  createShoppingItem,
  updateShoppingItem,
  toggleShoppingItemPurchased,
  deleteShoppingItem,
} from './shopping'

// Dogs
export {
  getDogs,
  createDog,
  updateDog,
  deleteDog,
  uploadDogPhoto,
  getDogMeals,
  toggleDogMeal,
} from './dogs'

// Recipes
export {
  getAllRecipes,
  getRecipesByIngredients,
  getAllIngredients,
  getUserIngredients,
  addUserIngredient,
  removeUserIngredient,
} from './recipes'

// Photos
export {
  uploadPhoto,
  getUserPhotos,
  deletePhoto,
  savePhotoAssignment,
  getPhotoAssignments,
  deletePhotoAssignment,
} from './photos'

// Groups
export {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
} from './groups'

// Routines
export {
  getRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineCompletion,
  toggleRoutineItem,
} from './routines'

// Notifications
export {
  savePushSubscription,
  deletePushSubscription,
  getPushSubscriptions,
  saveOneSignalPlayerId,
  type PushSubscription,
} from './notifications'

