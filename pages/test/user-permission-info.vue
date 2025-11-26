<script setup>
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { ROLE_PRESETS, useRolePresets } from "@/composables/useRolePresets";

definePageMeta({
  layout: "default",
});

const auth = useAuthStore();
const { getPermissions } = useRolePresets();

// 現在のユーザーの権限リスト
const userPermissions = computed(() => getPermissions(auth.roles));

// テスト用の権限チェックリスト
const permissionChecks = computed(() => {
  const checks = [];

  // 各プリセット役割の権限をチェック
  Object.keys(ROLE_PRESETS).forEach((roleKey) => {
    const preset = ROLE_PRESETS[roleKey];
    checks.push({
      category: `${preset.label} の権限`,
      items: preset.permissions.map((permission) => ({
        label: permission,
        hasPermission: auth.hasPermission(permission),
      })),
    });
  });

  return checks;
});

// 役割チェック
const roleChecks = computed(() => [
  { label: "super-user", hasRole: auth.hasRole("super-user") },
  { label: "admin", hasRole: auth.hasRole("admin") },
  { label: "manager", hasRole: auth.hasRole("manager") },
  { label: "controller", hasRole: auth.hasRole("controller") },
  { label: "accountant", hasRole: auth.hasRole("accountant") },
  { label: "labor", hasRole: auth.hasRole("labor") },
  { label: "legal", hasRole: auth.hasRole("legal") },
]);
</script>

<template>
  <v-container>
    <v-row>
      <!-- 現在のユーザー情報 -->
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-account-circle" class="mr-2" />
            現在のユーザー情報
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-account" />
                </template>
                <v-list-item-title>UID</v-list-item-title>
                <v-list-item-subtitle>{{ auth.uid }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-email" />
                </template>
                <v-list-item-title>Email</v-list-item-title>
                <v-list-item-subtitle>{{ auth.email }}</v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-shield-account" />
                </template>
                <v-list-item-title>Roles</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    v-for="role in auth.roles"
                    :key="role"
                    class="ma-1"
                    size="small"
                    color="primary"
                  >
                    {{ role }}
                  </v-chip>
                  <span
                    v-if="!auth.roles || auth.roles.length === 0"
                    class="text-medium-emphasis"
                  >
                    (なし)
                  </span>
                </v-list-item-subtitle>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-icon icon="mdi-lock-check" />
                </template>
                <v-list-item-title>Permissions</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    v-for="permission in userPermissions"
                    :key="permission"
                    class="ma-1"
                    size="small"
                    variant="tonal"
                  >
                    {{ permission }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 役割チェック -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-account-group" class="mr-2" />
            役割チェック (hasRole)
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-list density="compact">
              <v-list-item v-for="check in roleChecks" :key="check.label">
                <template #prepend>
                  <v-icon
                    :icon="
                      check.hasRole ? 'mdi-check-circle' : 'mdi-close-circle'
                    "
                    :color="check.hasRole ? 'success' : 'error'"
                  />
                </template>
                <v-list-item-title>{{ check.label }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 権限チェック -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-lock-check" class="mr-2" />
            権限チェック (hasPermission)
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-expansion-panels>
              <v-expansion-panel
                v-for="(check, index) in permissionChecks"
                :key="index"
              >
                <v-expansion-panel-title>
                  {{ check.category }}
                  <template #actions>
                    <v-chip size="small">
                      {{
                        check.items.filter((item) => item.hasPermission).length
                      }}
                      / {{ check.items.length }}
                    </v-chip>
                  </template>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact">
                    <v-list-item v-for="item in check.items" :key="item.label">
                      <template #prepend>
                        <v-icon
                          :icon="
                            item.hasPermission
                              ? 'mdi-check-circle'
                              : 'mdi-close-circle'
                          "
                          :color="item.hasPermission ? 'success' : 'error'"
                        />
                      </template>
                      <v-list-item-title>{{ item.label }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 役割プリセット一覧 -->
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-format-list-bulleted" class="mr-2" />
            役割プリセット一覧
          </v-card-title>
          <v-divider />
          <v-card-text>
            <v-row>
              <v-col
                v-for="(preset, key) in ROLE_PRESETS"
                :key="key"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card variant="outlined" height="100%">
                  <v-card-title class="text-subtitle-1">
                    <v-icon :icon="preset.icon" class="mr-2" />
                    {{ preset.label }}
                  </v-card-title>
                  <v-card-subtitle>{{ preset.description }}</v-card-subtitle>
                  <v-divider class="my-2" />
                  <v-card-text>
                    <div class="text-caption mb-2 font-weight-bold">権限:</div>
                    <v-chip
                      v-for="permission in preset.permissions"
                      :key="permission"
                      class="ma-1"
                      size="small"
                      variant="tonal"
                    >
                      {{ permission }}
                    </v-chip>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
