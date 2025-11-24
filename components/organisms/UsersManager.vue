<script setup>
/**
 * @file components/organisms/UsersManager.vue
 * @description A component to manage users.
 */
import { User } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const logger = useLogger("UsersManager", useErrorsStore());

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const user = reactive(new User());

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  user.subscribeDocs();
});

onUnmounted(() => {
  user.unsubscribe();
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Disable a user account.
 * @param item - User item to be disabled
 */
async function handleDisableUser(item) {
  await auth.disableUser({ uid: item.docId });
}

/**
 * Enable a user account.
 * @param item - User item to be enabled
 */
async function handleEnableUser(item) {
  await auth.enableUser({ uid: item.docId });
}
</script>

<template>
  <air-array-manager
    :model-value="user.docs"
    :schema="User"
    :before-edit="
      (editMode, item) => {
        item.companyId = auth.companyId;
      }
    "
    disable-delete
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    @error="(error) => logger.error({ error })"
    @error:clear="() => logger.clearError()"
  >
    <template #table="tableProps">
      <air-data-table v-bind="tableProps">
        <template v-slot:item.roles="{ item }">
          <v-icon v-if="item.roles.includes('admin')" color="primary"
            >mdi-check</v-icon
          >
        </template>
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              color="primary"
              :disabled="!item.disabled"
              size="x-small"
              @click="handleEnableUser(item)"
              >有効化</v-btn
            >
            <v-btn
              color="medium-emphasis"
              :disabled="item.disabled || item.docId === auth.uid"
              size="x-small"
              @click="handleDisableUser(item)"
              >無効化</v-btn
            >
            <v-btn
              prepend-icon="mdi-pencil"
              color="secondary"
              :disabled="item.disabled"
              size="x-small"
              @click="tableProps.toUpdate(item)"
              >編集
              <template v-slot:prepend>
                <v-icon color="white"></v-icon>
              </template>
            </v-btn>
          </div>
        </template>
      </air-data-table>
    </template>
  </air-array-manager>
</template>
