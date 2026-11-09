import type en from "@/messages/en.json";

// Makes t("typo") a compile error: English is the source of truth for every key.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
