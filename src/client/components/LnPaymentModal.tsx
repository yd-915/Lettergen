import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalCloseButton,
  ModalBody,
  Box,
  HStack,
  VStack,
  Button,
} from '@chakra-ui/react';
import { AiFillCheckCircle } from 'react-icons/ai';
import QRCode from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { milliSatsToCents } from '../../shared/utils';
import decodeInvoice from '@wasp/actions/decodeInvoice';
import lnPaymentStatus from '@wasp/actions/lnPaymentStatus';

type LightningInvoice = {
  status: string;
  successAction: {
    tag: string;
    message: string;
  };
  verify: string;
  routes: any[]; // You can replace this with a more specific type if needed
  pr: string;
};

type InvoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  lightningInvoice: LightningInvoice | null;
};

type Interval = ReturnType<typeof setInterval>;
let interval: Interval;

export default function LnPaymentModal({
  lightningInvoice,
  isOpen,
  onClose,
}: InvoiceModalProps) {
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [amountCents, setAmountCents] = useState<number | null>(null);

  const copyButtonRef = useRef(null);

  const handleCopyClick = () => {
    if (lightningInvoice) {
      navigator.clipboard.writeText(lightningInvoice.pr);
    }
  };

  const handleCloseClick = async () => {
    if (status !== 'success') {
      if (lightningInvoice) {
        lightningInvoice.status = 'failed';
        await lnPaymentStatus(lightningInvoice);
      }
    }
    if (interval) clearInterval(interval);
    onClose();
  };

  useEffect(() => {
    const paymentAmount = async () => {
      if (lightningInvoice) {
        const decodedInvoice = await decodeInvoice(lightningInvoice.pr);
        const amountSat = decodedInvoice.satoshis ? decodedInvoice.satoshis : 0;
        let amountCents = await milliSatsToCents(amountSat);
        amountCents = amountCents * 1000;
        return amountCents;
      }
      return null;
    };
    const fetchAmount = async () => {
      const amount = await paymentAmount();
      setAmountCents(amount);
    };

    if (lightningInvoice) {
      setIsReady(true);
      fetchAmount();
    }
  }, [lightningInvoice]);

  // Extract the payment amount from the invoice

  useEffect(() => {
    const verifyPayment = async () => {
      if (!lightningInvoice) return;

      try {
        const response = await fetch(lightningInvoice.verify);
        const result = await response.json();
        if (result.settled) {
          setStatus('success');

          lightningInvoice.status = 'success';
          await lnPaymentStatus(lightningInvoice);
          clearInterval(interval);
          setTimeout(() => onClose(), 2000); // TODO: check this
        } else {
          setStatus('pending');
        }
      } catch (error) {
        setStatus('error');

        lightningInvoice.status = 'failed';
        await lnPaymentStatus(lightningInvoice);
        setErrorMessage('Failed to verify payment.');
        clearInterval(interval);
      }
    };

    if (lightningInvoice) {
      setIsReady(true);
      interval = setInterval(verifyPayment, 1000);
    }
    return () => clearInterval(interval);
  }, [lightningInvoice, onClose]);

  let content = (
    <>
      {lightningInvoice && (
        <div className='rounded bg-white p-2'>
          <QRCode
            value={lightningInvoice.pr}
            size={224}
            onClick={handleCopyClick}
            // className='h-full w-full cursor-pointer'
          />
        </div>
      )}
    </>
  );

  if (status === 'success') {
    content = (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: 256,
          height: 256,
        }}
      >
        <AiFillCheckCircle size={128} color='green' />
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCloseClick} initialFocusRef={copyButtonRef}>
      <ModalOverlay backdropFilter='auto' backdropInvert='15%' backdropBlur='2px' />
      <ModalContent maxH='lg' maxW='lg' bgColor='bg-modal'>
        <ModalHeader>Lightning Invoice</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack gap={3}>
            <Box>{content}</Box>
            {amountCents !== null && <p className='mb-2 text-center'>Pay ${amountCents} for the API call</p>}
            <HStack gap={3}>
              <Button id='copy-button' ref={copyButtonRef} onClick={handleCopyClick}>
                Copy
              </Button>
              {!!lightningInvoice && (
                <a href={`lightning:${lightningInvoice.pr}`}>
                  <Button id='open-button'>Open in ⚡ Wallet</Button>
                </a>
              )}
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button size='sm' variant='outline' onClick={handleCloseClick}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
