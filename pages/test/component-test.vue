<script setup>
import dayjs from "dayjs";
import { AgreementV2 } from "@/schemas";

const data = [
  {
    dateAt: dayjs("2026-01-01").tz("Asia/Tokyo").toDate(),
    rates: {
      WEEKDAY: {
        DAY: {
          unitPriceBase: 16000,
          overtimeUnitPriceBase: 2000,
          unitPriceQualified: 18000,
          overtimeUnitPriceQualified: 2200,
        },
        NIGHT: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
      },
      SATURDAY: {
        DAY: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
        NIGHT: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
      },
      SUNDAY: {
        DAY: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
        NIGHT: {
          unitPriceBase: 22000,
          overtimeUnitPriceBase: 2800,
          unitPriceQualified: 24000,
          overtimeUnitPriceQualified: 3000,
        },
      },
      HOLIDAY: {
        DAY: {
          unitPriceBase: 21000,
          overtimeUnitPriceBase: 2700,
          unitPriceQualified: 23000,
          overtimeUnitPriceQualified: 3000,
        },
        NIGHT: {
          unitPriceBase: 23000,
          overtimeUnitPriceBase: 3000,
          unitPriceQualified: 25000,
          overtimeUnitPriceQualified: 3200,
        },
      },
    },
    cutoffDate: 0,
    billingUnitType: "PER_DAY",
  },
  {
    dateAt: dayjs("2026-03-01").tz("Asia/Tokyo").toDate(),
    rates: {
      WEEKDAY: {
        DAY: {
          unitPriceBase: 16000,
          overtimeUnitPriceBase: 2000,
          unitPriceQualified: 18000,
          overtimeUnitPriceQualified: 2200,
        },
        NIGHT: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
      },
      SATURDAY: {
        DAY: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
        NIGHT: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
      },
      SUNDAY: {
        DAY: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
        NIGHT: {
          unitPriceBase: 22000,
          overtimeUnitPriceBase: 2800,
          unitPriceQualified: 24000,
          overtimeUnitPriceQualified: 3000,
        },
      },
      HOLIDAY: {
        DAY: {
          unitPriceBase: 21000,
          overtimeUnitPriceBase: 2700,
          unitPriceQualified: 23000,
          overtimeUnitPriceQualified: 3000,
        },
        NIGHT: {
          unitPriceBase: 23000,
          overtimeUnitPriceBase: 3000,
          unitPriceQualified: 25000,
          overtimeUnitPriceQualified: 3200,
        },
      },
    },
    cutoffDate: 0,
    billingUnitType: "PER_DAY",
  },
  {
    dateAt: dayjs("2026-06-01").tz("Asia/Tokyo").toDate(),
    rates: {
      WEEKDAY: {
        DAY: {
          unitPriceBase: 16000,
          overtimeUnitPriceBase: 2000,
          unitPriceQualified: 18000,
          overtimeUnitPriceQualified: 2200,
        },
        NIGHT: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
      },
      SATURDAY: {
        DAY: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
        NIGHT: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
      },
      SUNDAY: {
        DAY: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
        NIGHT: {
          unitPriceBase: 22000,
          overtimeUnitPriceBase: 2800,
          unitPriceQualified: 24000,
          overtimeUnitPriceQualified: 3000,
        },
      },
      HOLIDAY: {
        DAY: {
          unitPriceBase: 21000,
          overtimeUnitPriceBase: 2700,
          unitPriceQualified: 23000,
          overtimeUnitPriceQualified: 3000,
        },
        NIGHT: {
          unitPriceBase: 23000,
          overtimeUnitPriceBase: 3000,
          unitPriceQualified: 25000,
          overtimeUnitPriceQualified: 3200,
        },
      },
    },
    cutoffDate: 0,
    billingUnitType: "PER_DAY",
  },
  {
    dateAt: dayjs("2026-07-01").tz("Asia/Tokyo").toDate(),
    rates: {
      WEEKDAY: {
        DAY: {
          unitPriceBase: 16000,
          overtimeUnitPriceBase: 2000,
          unitPriceQualified: 18000,
          overtimeUnitPriceQualified: 2200,
        },
        NIGHT: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
      },
      SATURDAY: {
        DAY: {
          unitPriceBase: 18000,
          overtimeUnitPriceBase: 2300,
          unitPriceQualified: 20000,
          overtimeUnitPriceQualified: 2500,
        },
        NIGHT: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
      },
      SUNDAY: {
        DAY: {
          unitPriceBase: 20000,
          overtimeUnitPriceBase: 2500,
          unitPriceQualified: 22000,
          overtimeUnitPriceQualified: 2800,
        },
        NIGHT: {
          unitPriceBase: 22000,
          overtimeUnitPriceBase: 2800,
          unitPriceQualified: 24000,
          overtimeUnitPriceQualified: 3000,
        },
      },
      HOLIDAY: {
        DAY: {
          unitPriceBase: 21000,
          overtimeUnitPriceBase: 2700,
          unitPriceQualified: 23000,
          overtimeUnitPriceQualified: 3000,
        },
        NIGHT: {
          unitPriceBase: 23000,
          overtimeUnitPriceBase: 3000,
          unitPriceQualified: 25000,
          overtimeUnitPriceQualified: 3200,
        },
      },
    },
    cutoffDate: 0,
    billingUnitType: "PER_DAY",
  },
];

const agreements = ref([]);
agreements.value = [...data]
  .sort((a, b) => {
    if (a.dateAt > b.dateAt) return 1;
    if (a.dateAt < b.dateAt) return -1;
    return 0;
  })
  .map((d) => new AgreementV2(d));
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <v-col cols="12" md="6" lg="4">
        <v-card>
          <v-card-item>
            <v-card-title> マネージャー </v-card-title>
          </v-card-item>
          <v-card-text> aaa </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </TemplatesFixedHeightContainer>
</template>

<style scoped></style>
