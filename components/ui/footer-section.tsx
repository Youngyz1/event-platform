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
    <footer className="relative border-t border-zinc-900 bg-zinc-950 text-white transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 md:px-10 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-16">
          <div>
            <BrandMark textClassName="text-white" />
            <h2 className="mt-7 text-3xl font-bold tracking-tight sm:text-4xl lg:text-3xl">
              Stay connected
            </h2>
            <p className="mb-8 mt-4 max-w-xs text-base leading-7 text-zinc-400 sm:text-lg lg:text-base">
              Get event launches, fundraiser updates, and platform news.
            </p>
            <form onSubmit={handleSubscribe} className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-14 rounded-full border-zinc-800 bg-zinc-950 px-5 pr-16 text-base font-semibold text-white placeholder:text-zinc-500 focus-visible:ring-orange-600"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1.5 top-1.5 h-11 w-11 rounded-full bg-orange-600 text-white transition-transform hover:scale-105 hover:bg-orange-700"
              >
                <Send className="h-5 w-5" />
                <span className="sr-only">Subscribe</span>
              </Button>
            </form>
          </div>

          <div>
            <h3 className="mb-5 text-2xl font-semibold tracking-tight lg:text-xl">
              Quick links
            </h3>
            <nav className="space-y-3 text-base text-zinc-400 sm:text-lg lg:text-base">
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
            <h3 className="mb-5 text-2xl font-semibold tracking-tight lg:text-xl">
              Contact us
            </h3>
            <address className="max-w-xs space-y-3 text-base leading-7 text-zinc-400 not-italic sm:text-lg lg:text-base">
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
            <h3 className="mb-6 text-2xl font-semibold tracking-tight lg:text-xl">
              Follow us
            </h3>
            <div className="mb-8 flex flex-wrap gap-4">
              <TooltipProvider>
                {socialLinks.map(([label, Icon]) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-orange-500 hover:bg-zinc-900 hover:text-orange-500"
                      >
                        <Icon className="h-5 w-5" />
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
            <div className="flex items-center space-x-3">
              <Sun className="h-5 w-5 text-white" />
              <Switch
                id="dark-mode"
                checked={isDarkMode}
                onCheckedChange={setIsDarkMode}
                className="data-[state=checked]:bg-orange-600"
              />
              <Moon className="h-5 w-5 text-white" />
              <Label htmlFor="dark-mode" className="sr-only">
                Toggle dark mode
              </Label>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center border-t border-zinc-800 pt-8 text-center lg:mt-16">
          <p className="text-base text-zinc-500">
            © 2026 EventBrithe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export { Footerdemo };
