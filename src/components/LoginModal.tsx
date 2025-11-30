import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Checkbox, Input, Link } from "@heroui/react";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { app } from "../firebase";

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
}

export default function LoginModal({ isOpen, onOpenChange }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const auth = getAuth(app);

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Password reset email sent! Please check your inbox.");
      setPassword("");
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      let errorMessage = "Failed to send password reset email";

      if (errorObj.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (errorObj.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (errorObj.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later";
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // Set persistence based on "Remember me" checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      await signInWithEmailAndPassword(auth, email, password);
      onOpenChange(); // Close modal on success
      setEmail("");
      setPassword("");
      setEmailError("");
      setPasswordError("");
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      let errorMessage = "Failed to sign in";

      if (errorObj.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (errorObj.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (errorObj.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (errorObj.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled";
      } else if (errorObj.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later";
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setError("");
    setSuccess("");
    setEmailError("");
    setPasswordError("");
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} placement="top-center" onOpenChange={handleClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
              <h2 className="text-2xl font-bold">Log in</h2>
              <p className="text-sm text-default-500 font-normal">Enter your credentials to access your account</p>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {(error || success) && (
                <div
                  className={`${
                    error ? "bg-danger-50 border-danger-200" : "bg-success-50 border-success-200"
                  } border rounded-lg p-3 flex items-start gap-4`}
                >
                  <span className={`${error ? "text-danger" : "text-success"} text-sm`}>{error || success}</span>
                </div>
              )}
              <Input
                label="Email"
                placeholder="Enter your email"
                variant="bordered"
                value={email}
                labelPlacement="outside"
                onChange={(e) => {
                  setEmail(e.target.value.trim());
                  setEmailError("");
                }}
                onBlur={() => validateEmail(email)}
                isInvalid={!!emailError}
                errorMessage={emailError}
                isRequired
                type="email"
                autoComplete="email"
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                type="password"
                variant="bordered"
                value={password}
                labelPlacement="outside"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                onBlur={() => validatePassword(password)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSignIn();
                  }
                }}
                isInvalid={!!passwordError}
                errorMessage={passwordError}
                isRequired
                autoComplete="current-password"
              />
              <div className="flex py-2 px-1 justify-between items-center">
                <Checkbox
                  classNames={{
                    label: "text-small",
                  }}
                  isSelected={rememberMe}
                  onValueChange={setRememberMe}
                >
                  Remember me
                </Checkbox>
                <Link color="primary" size="sm" className="cursor-pointer" onPress={handleForgotPassword}>
                  Forgot password?
                </Link>
              </div>
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-0">
              <Button color="danger" variant="light" onPress={onClose} className="flex-1">
                Close
              </Button>
              <Button
                color="primary"
                onPress={handleSignIn}
                isLoading={isLoading}
                isDisabled={isLoading || !!emailError || !!passwordError}
                className="flex-1"
              >
                Sign in
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
