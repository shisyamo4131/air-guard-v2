<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedule/Table/index.vue
 * @description A table component to dislay a SiteOperationSchedule.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import dayjs from "dayjs";
import { useFetch } from "@/composables/fetch/useFetch";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  arrangementNotifications: {
    type: Array,
    default: () => [],
    validator: (v) =>
      v.every((item) => item instanceof ArrangementNotification),
  },
  schedule: {
    type: Object,
    required: true,
    validator: (v) => v instanceof SiteOperationSchedule,
  },
});
const props = useDefaults(_props, "SiteOperationScheduleTable");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("SiteOperationScheduleTable");
const { fetchSite, cachedSites } = fetchSiteComposable;
const { SHIFT_TYPE } = useConstants();

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.schedule,
  (newVal) => {
    if (newVal && newVal.siteId) fetchSite(newVal.siteId);
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const date = computed(() => {
  return dayjs(props.schedule.date)
    .tz("Asia/Tokyo")
    .format("YYYY年MM月DD日 (ddd)");
});

/**
 * 仮登録現場であるかどうかを返します。
 * - `cachedSites` に現場情報が読み込めない場合、仮登録現場とみなします。
 */
const isTemporarySite = computed(() => {
  return cachedSites.value[props.schedule.siteId]?.isTemporary;
});

const shiftType = computed(() => {
  return (
    SHIFT_TYPE.value[props.schedule.shiftType]?.title ||
    props.schedule.shiftType
  );
});
</script>

<template>
  <v-table>
    <tbody>
      <!-- 基本情報 -->
      <tr>
        <td style="width: 120px">日付</td>
        <td>{{ date }}</td>
      </tr>

      <!-- TR: 取引先 -->
      <tr>
        <td>取引先</td>

        <!-- 仮登録現場の場合はその旨を表示 -->
        <!-- NOTE: 仮登録現場の場合は稼働実績（OperationResult）登録不可 -->
        <!-- NOTE: 将来ここから直接取引先を設定できるようにしたいが、cachedSites にキャッシュされている現場情報はパッシブに更新されないので注意 -->
        <td v-if="isTemporarySite">
          <span class="text-warning">
            取引先未設定の為、稼働実績として登録できません。
          </span>
        </td>

        <!-- 本登録現場であれば取引先名を表示 -->
        <td v-else>
          {{
            cachedSites[props.schedule.siteId]?.customer?.abbreviation ||
            "loading..."
          }}
        </td>
      </tr>

      <!-- TR: 現場名 -->
      <tr>
        <td>現場名</td>
        <td>{{ cachedSites[props.schedule.siteId]?.name || "loading..." }}</td>
      </tr>

      <!-- TR: 定時時間 -->
      <tr>
        <td>定時時間</td>
        <td>
          {{ shiftType }}
          {{ `${props.schedule.startTime} - ${props.schedule.endTime}` }}
        </td>
      </tr>

      <!-- TR: 作業員リスト -->
      <tr>
        <td colspan="2">
          <WorkersTable
            :workers="props.schedule.workers"
            :arrangement-notifications="props.arrangementNotifications"
          >
            <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
              <slot :name="slotName" v-bind="scope ?? {}"></slot>
            </template>
          </WorkersTable>
        </td>
      </tr>
    </tbody>
  </v-table>
</template>
