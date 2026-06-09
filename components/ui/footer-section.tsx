"use client";

import * as React from "react";
import Link from "next/link";
import {
  AtSign,
  Globe,
  MessageCircle,
  Moon,
  Network,
  Send,
  Sun,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const quickLinks = [
  ["Home", "/"],
  ["About", "/about"],
  ["Platform", "/platform"],
  ["Events", "/events"],
  ["Fundraisers", "/fundraisers"],
  ["Create Event", "/create-event"],
  ["Start Fundraiser", "/create-fundraiser"],
  ["Privacy", "/privacy"],
] as const;

const socialLinks = [
  ["Community", Globe],
  ["Updates", MessageCircle],
  ["Email", AtSign],
  ["Partners", Network],
] as const;

function Footerdemo() {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("eventbrithe-theme");
    if (savedTheme === "dark") setIsDarkMode(true);
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem(
      "eventbrithe-theme",
      isDarkMode ? "dark" : "light"
    );
  }, [isDarkMode]);

  function handleSubscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <footer className="relative border-t border-zinc-200 bg-white text-zinc-950 transition-colors duration-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandMark textClassName="text-zinc-950 dark:text-white" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight">
              Stay connected
            </h2>
            <p className="mb-6 mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Get event launches, fundraiser updates, and platform news.
            </p>
            <form onSubmit={handleSubscribe} className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-11 rounded-full pr-12"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-9 w-9 rounded-full bg-orange-600 text-white transition-transform hover:scale-105 hover:bg-orange-700"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Subscribe</span>
              </Button>
            </form>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick links</h3>
            <nav className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {quickLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block transition-colors hover:text-orange-600"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact us</h3>
            <address className="space-y-2 text-sm not-italic text-zinc-600 dark:text-zinc-400">
              <p>EventBrithe Support</p>
              <p>Events, fundraising & community commerce.</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:support@eventbrithe.com"
                  className="font-semibold text-orange-600"
                >
                  support@eventbrithe.com
                </a>
              </p>
            </address>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Follow us</h3>
            <div className="mb-6 flex space-x-3">
              <TooltipProvider>
                {socialLinks.map(([label, Icon]) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full border-zinc-200 bg-white text-zinc-700 hover:border-orange-200 hover:text-orange-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="sr-only">{label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch
                id="dark-mode"
                checked={isDarkMode}
                onCheckedChange={setIsDarkMode}
              />
              <Moon className="h-4 w-4" />
              <Label htmlFor="dark-mode" className="sr-only">
                Toggle dark mode
              </Label>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center border-t border-zinc-200 pt-8 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            © 2026 EventBrithe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export { Footerdemo };
