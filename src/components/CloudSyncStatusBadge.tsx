import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudOff, ShieldAlert } from "lucide-react";

import { useAppStore } from "@/lib/AppStore";
import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";
import { CLOUD_CONFLICT_CHANGED_EVENT, hasCloudConflict } from "@/lib/cloudSyncState";

type CloudSyncStatus