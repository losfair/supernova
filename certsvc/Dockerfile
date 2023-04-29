FROM public.ecr.aws/lambda/go:1

COPY certsvc ${LAMBDA_TASK_ROOT}
COPY nebula-cert ${LAMBDA_TASK_ROOT}

CMD [ "certsvc" ]
