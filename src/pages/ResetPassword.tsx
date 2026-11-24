import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

const MIN_PASSWORD_LENGTH = 6;

const ResetPassword = () => {
  const { isPasswordRecovery, recoveryError, updatePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(newPassword);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPasswordRecovery) {
    return (
      <div className="min-h-screen quiz-pattern flex items-center justify-center px-4 py-6">
        <div className="w-full sm:max-w-md">
          <Card className="border-2 border-quiz-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                Invalid or expired reset link
              </CardTitle>
              <CardDescription className="text-center">
                {recoveryError ||
                  "This password reset link is no longer valid. Reset links can only be used once and expire after a short time."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-2">
              <Button asChild className="w-full quiz-gradient">
                <Link to="/forgot-password">Request a new reset link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/">Back to sign in</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen quiz-pattern flex items-center justify-center px-4 py-6">
      <div className="w-full sm:max-w-md">
        <Card className="border-2 border-quiz-primary/20 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Reset Password
            </CardTitle>
            <CardDescription className="text-center">
              Choose a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                    autoComplete="new-password"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>

              <Button
                type="submit"
                className="w-full quiz-gradient"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              disabled={isSubmitting}
            >
              Back to sign in
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
