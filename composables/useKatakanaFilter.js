import { ref } from "vue";

export function useKatakanaFilter() {
  const selectedCharNumber = ref(0);

  const selectableChars = [
    { title: "全", value: /.*/ },
    { title: "ア", value: /^[ア-オ]/ },
    { title: "カ", value: /^[カ-ゴ]/ },
    { title: "サ", value: /^[サ-ゾ]/ },
    { title: "タ", value: /^[タ-ド]/ },
    { title: "ナ", value: /^[ナ-ノ]/ },
    { title: "ハ", value: /^[ハ-ポ]/ },
    { title: "マ", value: /^[マ-モ]/ },
    { title: "ヤ", value: /^[ヤ-ヨ]/ },
    { title: "ラ", value: /^[ラ-ロ]/ },
    { title: "ワ", value: /^[ワ-ン]/ },
  ];

  const filterByKatakana = (data, nameProperty = "name") => {
    const selectedRegex = selectableChars[selectedCharNumber.value]?.value;
    if (!selectedRegex) return data;

    return data.filter((item) => selectedRegex.test(item[nameProperty]));
  };

  return {
    selectedCharNumber,
    selectableChars,
    filterByKatakana,
  };
}
