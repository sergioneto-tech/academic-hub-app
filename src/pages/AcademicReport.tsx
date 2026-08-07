import { useMemo, useState } from "react";
import "@/report-print.css";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import { finalGradeRounded, getAssessments } from "@/lib/calculations";
import type { Assessment, Course } from "@/lib/types";
