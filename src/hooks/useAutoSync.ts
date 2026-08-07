import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import { APP_VERSION } from "@/lib/version";
import { CLOUD_SYNC_NOTICE_EVENT, type CloudSyncNoticeDetail } from "@/components/CloudSyncNotice";
import {
  CLOUD_CONFLICT_CHANGED_EVENT,
  CLOUD_CONFLICT_KEY,
  cloudStateFingerprint,
  getDeviceId,
  getDeviceLabel,
  getSync