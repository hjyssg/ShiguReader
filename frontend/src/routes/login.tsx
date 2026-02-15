import { createFileRoute, redirect } from "@tanstack/react-router"
import { useForm } from "react-hook-form"

import type { Body_login_login_access_token as LoginProps } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { FormField, FormStack } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async ({ context }: any) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
})

function Login() {
  const { loginMutation } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginProps>({
    mode: "onBlur",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginProps) => {
    if (isSubmitting) return
    loginMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormStack>
              <FormField>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  {...register("username", {
                    required: "Email is required",
                  })}
                />
                {errors.username && (
                  <p className="text-destructive text-xs">
                    {errors.username.message}
                  </p>
                )}
              </FormField>
              <FormField>
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="/recover-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">
                    {errors.password.message}
                  </p>
                )}
              </FormField>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Login
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
              >
                Login with Google
              </Button>
            </FormStack>
            <div className="mt-4 text-center text-sm">
              Don't have an account?{" "}
              <a href="/signup" className="underline underline-offset-4">
                Sign up
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
