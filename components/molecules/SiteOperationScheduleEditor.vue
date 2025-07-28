<script setup>
/** define options */
defineOptions({ inheritAttrs: false });

/** define props */
const props = defineProps({
  inputProps: { type: Object, required: true },
  agreements: { type: Array, default: () => [] },
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onAgreementSelected(agreement) {
  agreement.dateAt = props.inputProps.item.dateAt;
  props.inputProps.updateProperties(agreement);
}
</script>

<template>
  <MoleculesEditCard
    v-bind="$attrs"
    :disable-delete="!props.inputProps.item.isDraft"
    :disable-submit="!props.inputProps.item.isDraft"
  >
    <template #header>
      <v-alert
        v-if="!props.inputProps.item.isDraft"
        color="info"
        variant="outlined"
        class="mb-4"
        density="compact"
        >確定された現場稼働予定であるため編集・削除できません。</v-alert
      >
    </template>
    <template #default>
      <air-item-input v-bind="props.inputProps">
        <template #after-dateAt>
          <v-col cols="12">
            <MoleculesAgreementSelector
              :items="props.agreements"
              :btn-props="{ block: true, color: 'primary' }"
              label="取極めから複製"
              @select="onAgreementSelected"
            />
          </v-col>
        </template>
      </air-item-input>
    </template>
  </MoleculesEditCard>
</template>
