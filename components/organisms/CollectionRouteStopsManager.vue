<script setup>
import { ref, computed, watch } from "vue";
import { useLogger } from "~/composables/useLogger";
import { Site } from "~/schemas/Site"; // air-autocomplete-api のため
import { useFetchSite } from "~/composables/useFetchSite";
import { useLocalizedConstants } from "~/composables/useLocalizedConstants";

const props = defineProps({
  /** 管理対象の回収順序（stops）プロパティを保有する CollectionRoute インスタンス */
  model: { type: Object, required: true },
});

const logger = useLogger();
const { fetchSite, cachedSites } = useFetchSite();
const { dayOfWeeksForSelect } = useLocalizedConstants();

const editingModel = ref(null); // 編集用のCollectionRouteインスタンス
const selectedDayOfWeek = ref(0);
const selectedSite = ref(null);

/**
 * isEditingStops
 * 現在、回収順序が編集中であるかどうかを表すフラグです。
 * - watcher によって監視し、true に更新された場合は props.model のクローンを editingModel に作成します。
 * - false に更新されたら editingModel と selectedSite をクリアします。
 */
const isEditingStops = ref(false);
watch(isEditingStops, (newVal) => {
  if (newVal) {
    // 編集開始: props.modelのクローンを編集用インスタンスに
    editingModel.value = props.model.clone();
  } else {
    // 編集終了: 編集用インスタンスをクリア
    editingModel.value = null;
    selectedSite.value = null;
  }
});

// 表示用のstopsリスト
const displayedStops = computed(() => {
  // 編集モード時はeditingModelから、そうでなければprops.modelからstopsを取得
  const sourceModel =
    isEditingStops.value && editingModel.value
      ? editingModel.value
      : props.model;
  if (!sourceModel.stops) return [];
  // 配列の順序がそのままsequenceを表すため、ソートは不要
  return sourceModel.stops.filter(
    (stop) => stop.dayOfWeek === selectedDayOfWeek.value
  );
});

// displayedStops が変更されたときに、関連するサイト情報をフェッチします。
watch(
  displayedStops,
  async (currentStops) => {
    if (currentStops && currentStops.length > 0) {
      await fetchSite(currentStops);
    }
  },
  { deep: true, immediate: true } // 初期表示時およびstopsの内容変更時に実行
);

/**
 * 選択された排出場所を現在の曜日の回収順序に追加します。
 */
function _addSelectedSiteToStops() {
  if (selectedSite.value && editingModel.value) {
    const newStopData = {
      dayOfWeek: selectedDayOfWeek.value,
      siteId: selectedSite.value,
      remarks: "", // remarksの初期値
    };
    try {
      if (typeof editingModel.value.addStop === "function") {
        editingModel.value.addStop(newStopData);
        selectedSite.value = null; // 追加後、選択をクリア
      } else {
        logger.error({
          sender: "addSelectedSiteToStops",
          message: "editingModel.addStop is not a function.",
          context: editingModel.value,
        });
      }
    } catch (error) {
      logger.error({
        sender: "addSelectedSiteToStops",
        message: error.message,
        error,
      });
    }
  }
}

/**
 * 指定された排出場所を現在の曜日の回収順序から削除します。
 * @param {object} stopToRemove - 削除するStopオブジェクト。
 * @param {string} stopToRemove.siteId - 削除するStopのsiteId。
 * @param {number} stopToRemove.dayOfWeek - 削除するStopのdayOfWeek。
 */
function _removeSiteFromStops(stopToRemove) {
  if (editingModel.value && stopToRemove) {
    try {
      if (typeof editingModel.value.removeStop === "function") {
        editingModel.value.removeStop(stopToRemove); // removeStopには stopObject を渡す想定
      } else {
        logger.error({
          sender: "_removeSiteFromStops",
          message: "editingModel.removeStop is not a function.",
          context: editingModel.value,
        });
      }
    } catch (error) {
      logger.error({
        sender: "_removeSiteFromStops",
        message: error.message,
        error,
      });
    }
  }
}
/**
 * 回収順序の編集をキャンセルします。
 */
function _cancelEditStops() {
  isEditingStops.value = false;
  // editingModel は watch によって null に設定される
}

/**
 * 編集された回収順序を保存します。
 */
async function _saveStops() {
  if (!editingModel.value) return;
  try {
    // editingModelのstopsでprops.modelのstopsを更新
    props.model.stops = JSON.parse(JSON.stringify(editingModel.value.stops)); // リアクティビティのためディープコピー
    await props.model.update();
    isEditingStops.value = false;
  } catch (error) {
    logger.error({ sender: "_saveStops", message: error.message, error });
  }
}
</script>

<template>
  <v-card>
    <v-toolbar density="comfortable">
      <v-toolbar-title>回収順序</v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="!isEditingStops"
        v-on:click="isEditingStops = true"
        icon="mdi-pencil"
      />
      <template v-else>
        <v-btn
          v-if="editingModel"
          v-on:click="_cancelEditStops"
          icon="mdi-close"
          color="error"
        />
        <v-btn
          v-on:click="_saveStops"
          icon="mdi-check"
          color="primary"
          :disabled="!(editingModel && editingModel.isStopsChanged)"
        />
      </template>
    </v-toolbar>
    <v-container>
      <!-- 曜日選択 -->
      <air-select
        v-model="selectedDayOfWeek"
        :items="dayOfWeeksForSelect"
        label="曜日"
        :disabled="isEditingStops"
      />

      <!-- 排出場所選択 -->
      <v-expand-transition>
        <div v-show="isEditingStops">
          <air-autocomplete-api
            v-model="selectedSite"
            :disabled="!isEditingStops"
            label="排出場所"
            append-icon="mdi-plus"
            autocomplete="off"
            :api="
              async (search) =>
                await new Site().fetchDocs({ constraints: search })
            "
            item-title="name"
            item-value="docId"
            @click:append="_addSelectedSiteToStops"
          />
        </div>
      </v-expand-transition>
    </v-container>
    <v-container class="pt-0">
      <v-list>
        <v-list-item v-for="(stop, index) in displayedStops" :key="stop.siteId">
          <template v-slot:prepend>
            <span class="mr-3">{{ index + 1 }}.</span>
          </template>
          <v-list-item-title>{{
            cachedSites[stop.siteId]?.name || "読み込み中..."
          }}</v-list-item-title>
          <v-list-item-subtitle>{{
            cachedSites[stop.siteId]?.fullAddress || "読み込み中..."
          }}</v-list-item-subtitle>
          <template v-slot:append>
            <v-btn
              v-if="isEditingStops"
              icon="mdi-delete"
              variant="text"
              @click="() => _removeSiteFromStops(stop)"
            ></v-btn>
          </template>
        </v-list-item>
      </v-list>
    </v-container>
  </v-card>
</template>
